import logging
from rq.job import Job
from config import get_ingestion_queue

logger = logging.getLogger(__name__)

def enqueue_document_processing(document_id: str, file_path: str, role_access: str) -> str:
    """
    Enqueue a document for processing (chunking + embedding).
    """
    queue = get_ingestion_queue()
    try:
        # We assume there's a function process_document in the worker
        job = queue.enqueue(
            'worker.process_document',
            args=(document_id, file_path, role_access),
            job_timeout='30m'
        )
        return job.id
    except Exception as e:
        logger.error(f"Failed to enqueue document {document_id}: {str(e)}")
        raise e

def enqueue_repo_processing(repo_id: str, repo_url: str, role_access: str) -> str:
    """
    Enqueue a git repository for processing (AST parsing + asset extraction).
    """
    queue = get_ingestion_queue()
    try:
        job = queue.enqueue(
            'worker.process_git_repo',
            args=(repo_id, repo_url, role_access),
            job_timeout='1h'
        )
        return job.id
    except Exception as e:
        logger.error(f"Failed to enqueue repo {repo_url}: {str(e)}")
        raise e

def get_job_status(job_id: str):
    """
    Get the status of a job from RQ.
    """
    queue = get_ingestion_queue()
    job = Job.fetch(job_id, connection=queue.connection)
    if not job:
        return None
    
    return {
        "job_id": job.id,
        "status": job.get_status(),
        "is_finished": job.is_finished,
        "is_failed": job.is_failed,
        "result": job.result
    }
