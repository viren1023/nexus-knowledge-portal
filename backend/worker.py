import os
import sys
import uuid
import logging
from rq import Worker

# Add the backend directory to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from config import get_redis_connection
from app.database import SessionLocal
from app.models.document import Document, DocumentChunk
from app.models.asset import GitRepo, ReusableAsset
from app.models.project import Project
from app.models.developer import Developer
from app.services.ingestion.document_processor import process_document as doc_processor
from app.services.ingestion.image_processor import process_image
from app.services.ingestion.git_analyzer import EnhancedGitAnalyzer
from app.services.ingestion.embedding_service import get_embedding
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def process_document(document_id: str, file_path: str, role_access: str):
    logger.info(f"Processing document {document_id} from {file_path}")

    try:
        file_name = os.path.basename(file_path)

        ext = file_name.split('.')[-1].lower()

        if ext in ['png', 'jpg', 'jpeg']:
            chunk = process_image(file_path, role_access, file_name)
            chunk['embedding'] = get_embedding(chunk['content'])
            chunks = [chunk]
        else:
            chunks = doc_processor(
                document_id,
                file_path,
                role_access,
                file_name
            )

            for chunk in chunks:
                chunk['embedding'] = get_embedding(chunk['content'])

        db = SessionLocal()

        try:
            doc = db.query(Document).filter(
                Document.id == document_id
            ).first()

            if not doc:
                logger.error(
                    f"Document {document_id} not found in DB"
                )
                return {
                    "status": "failed",
                    "error": "Document not found"
                }

            db_chunks = []

            for i, chunk in enumerate(chunks):
                db_chunk = DocumentChunk(
                    document_id=document_id,
                    chunk_order=i,
                    content=chunk['content'],
                    role=role_access,
                    embedding=chunk['embedding'],
                    metadata_=chunk.get('metadata', {})
                )
                db_chunks.append(db_chunk)

            db.add_all(db_chunks)

            doc.processing_status = 'completed'

            db.commit()

            logger.info(
                f"Successfully processed "
                f"{len(chunks)} chunks for {document_id}"
            )

            return {
                "status": "success",
                "chunks_count": len(chunks)
            }

        except Exception as e:
            db.rollback()

            doc = db.query(Document).filter(
                Document.id == document_id
            ).first()

            if doc:
                doc.processing_status = 'failed'
                doc.processing_error = str(e)
                db.commit()

            raise

        finally:
            db.close()

    except Exception as e:
        logger.error(
            f"Error processing document {document_id}: {e}"
        )
        raise


def process_git_repo(repo_id: str, repo_url: str, role_access: str):
    logger.info(f"Processing git repo {repo_url}")

    try:
        # Use the enhanced analyzer that returns assets + readme_chunks + project_metadata
        analyzer = EnhancedGitAnalyzer(
            repo_url=repo_url,
            repo_id=repo_id,
            project_id="",  # not needed here; project_id is on GitRepo row
        )
        result = analyzer.analyze()
        assets = result["assets"]
        readme_chunks = result["readme_chunks"]
        project_metadata = result["project_metadata"]
        local_dir = result["local_dir"]

        # Generate embeddings for code assets
        for asset in assets:
            text_to_embed = (
                f"{asset['full_signature']}\n"
                f"{asset.get('docstring', '')}"
            )
            asset["embedding"] = get_embedding(text_to_embed)

        # Generate embeddings for README chunks
        for chunk in readme_chunks:
            chunk["embedding"] = get_embedding(chunk["content"])

        db = SessionLocal()

        try:
            repo = db.query(GitRepo).filter(
                GitRepo.id == repo_id
            ).first()

            if not repo:
                logger.error(f"Repo {repo_id} not found in DB")
                return {"status": "failed", "error": "Repo not found"}

            # ----------------------------------------------------------------
            # 1. Store code assets (ReusableAsset rows)
            # ----------------------------------------------------------------
            db_assets = []
            for asset in assets:
                db_asset = ReusableAsset(
                    repo_id=repo_id,
                    asset_name=asset.get("asset_name", "Unknown"),
                    asset_type=asset.get("asset_type"),
                    language=asset.get("language"),
                    full_signature=asset.get("full_signature", ""),
                    docstring=asset.get("docstring"),
                    reusability_score=asset.get("reusability_score", 0),
                    call_count=asset.get("call_count", 0),
                    file_path=asset.get("file_path"),
                    embedding=asset["embedding"],
                    dependencies=asset.get("dependencies", []),
                    example_usage=asset.get("example_usage"),
                )
                db_assets.append(db_asset)
            db.add_all(db_assets)

            # ----------------------------------------------------------------
            # 2. Store README chunks as DocumentChunk rows
            #    We create a synthetic Document record for the README so the
            #    existing hybrid_search pipeline can retrieve it.
            # ----------------------------------------------------------------
            if readme_chunks:
                # Use project creator as the uploader for the system-generated README doc
                project = db.query(Project).filter(Project.id == repo.project_id).first()
                system_user_id = project.created_by if project else None
                if not system_user_id:
                    dev = db.query(Developer).first()
                    system_user_id = dev.id if dev else None

                readme_actual_path = os.path.join(local_dir, "README.md")
                for rname in ["README.md", "readme.md", "README.txt", "README", "Readme.md"]:
                    cand = os.path.join(local_dir, rname)
                    if os.path.exists(cand):
                        readme_actual_path = cand
                        break

                readme_doc = Document(
                    id=uuid.uuid4(),
                    project_id=repo.project_id,
                    file_name=f"README ({repo.repo_name})",
                    file_path=readme_actual_path,
                    file_type="md",
                    role_access=role_access,
                    uploaded_by=system_user_id,
                    processing_status="completed",
                    metadata_={"repo_id": str(repo_id), "source_type": "readme"},
                )
                db.add(readme_doc)
                db.flush()  # so readme_doc.id is available

                db_readme_chunks = []
                for chunk in readme_chunks:
                    db_chunk = DocumentChunk(
                        document_id=readme_doc.id,
                        chunk_order=chunk["chunk_order"],
                        content=chunk["content"],
                        chunk_path=chunk.get("chunk_path", ""),
                        role=role_access,
                        source_type="readme",
                        file_name=f"README ({repo.repo_name})",
                        embedding=chunk["embedding"],
                        metadata_={
                            "repo_id": str(repo_id),
                            "section": chunk.get("metadata", {}).get("section", ""),
                        },
                    )
                    db_readme_chunks.append(db_chunk)
                db.add_all(db_readme_chunks)
                logger.info(f"Stored {len(db_readme_chunks)} README chunks for repo {repo_url}")

            # ----------------------------------------------------------------
            # 3. Update GitRepo metadata and status
            # ----------------------------------------------------------------
            repo.processing_status = "completed"
            repo.indexed_at = datetime.utcnow()
            repo.local_path = local_dir
            repo.languages = project_metadata.get("languages", [])
            repo.metadata_ = {
                "structure_analysis": {
                    "project_type": project_metadata.get("project_type"),
                    "languages": project_metadata.get("languages", []),
                    "entry_points": project_metadata.get("entry_points", []),
                    "key_directories": project_metadata.get("key_directories", {}),
                    "summary": project_metadata.get("summary", ""),
                },
                "description": project_metadata.get("description", ""),
                "readme_chunks_count": len(readme_chunks),
                "assets_count": len(assets),
            }

            db.commit()

            logger.info(
                f"Successfully processed repo {repo_url}: "
                f"{len(assets)} assets, {len(readme_chunks)} README chunks"
            )

            return {
                "status": "success",
                "assets_count": len(assets),
                "readme_chunks_count": len(readme_chunks),
            }

        except Exception as e:
            db.rollback()

            repo = db.query(GitRepo).filter(
                GitRepo.id == repo_id
            ).first()

            if repo:
                repo.processing_status = "failed"
                repo.processing_error = str(e)
                db.commit()

            raise

        finally:
            db.close()

    except Exception as e:
        logger.error(f"Error processing git repo {repo_url}: {e}")
        raise


if __name__ == '__main__':
    redis_conn = get_redis_connection()

    worker = Worker(
        ['ingestion'],
        connection=redis_conn
    )

    worker.work()