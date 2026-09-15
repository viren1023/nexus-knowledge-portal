import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { documentService, getAssetContentUrl, getAssetDownloadUrl } from '../services/api';
import Header from '../components/Header';

const CODE_EXTENSIONS = new Set([
  'js','jsx','ts','tsx','py','json','html','css','scss','yaml','yml',
  'sh','bash','java','go','rs','cpp','c','h','cs','php','rb','kt',
  'swift','sql','xml','toml','ini','env','dockerfile','makefile',
  'tf','hcl','graphql','r','lua','scala','dart',
]);
const IMAGE_EXTENSIONS = new Set(['png','jpg','jpeg','webp','gif','svg']);
const LANG_MAP = {
  js:'javascript',jsx:'jsx',ts:'typescript',tsx:'tsx',py:'python',json:'json',
  html:'html',css:'css',scss:'scss',yaml:'yaml',yml:'yaml',sh:'bash',bash:'bash',
  java:'java',go:'go',rs:'rust',cpp:'cpp',c:'c',h:'c',cs:'csharp',php:'php',
  rb:'ruby',kt:'kotlin',swift:'swift',sql:'sql',xml:'xml',toml:'toml',
  graphql:'graphql',r:'r',lua:'lua',scala:'scala',dart:'dart',dockerfile:'dockerfile',
  tf:'hcl',hcl:'hcl',
};

function getViewerType(ext) {
  if (!ext) return 'unknown';
  const e = ext.toLowerCase();
  if (e === 'pdf') return 'pdf';
  if (IMAGE_EXTENSIONS.has(e)) return 'image';
  if (e === 'md' || e === 'markdown') return 'markdown';
  if (e === 'txt') return 'text';
  if (CODE_EXTENSIONS.has(e)) return 'code';
  return 'unsupported';
}

const FILE_ICONS = { pdf: '📄', image: '🖼️', md: '📝', txt: '📃', code: '💻', file: '📎' };

function getFileIconEmoji(ext) {
  const e = (ext || '').toLowerCase();
  if (e === 'pdf') return FILE_ICONS.pdf;
  if (IMAGE_EXTENSIONS.has(e)) return FILE_ICONS.image;
  if (e === 'md' || e === 'markdown') return FILE_ICONS.md;
  if (e === 'txt') return FILE_ICONS.txt;
  if (CODE_EXTENSIONS.has(e)) return FILE_ICONS.code;
  return FILE_ICONS.file;
}

function LoadingSkeleton() {
  return (
    <div style={{padding:40,display:'flex',flexDirection:'column',gap:16}}>
      <style>{'@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}'}</style>
      {[1,2,3,4,5].map(i=>(
        <div key={i} style={{
          height:i===1?28:18,borderRadius:6,
          background:'linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)',
          backgroundSize:'200% 100%',animation:'shimmer 1.4s infinite',width:(90-i*8)+'%',
        }}/>
      ))}
    </div>
  );
}

function TopBar({ asset, projectId, onBack }) {
  const isGit = asset.type === 'git_repo';
  const ext = (asset.file_type || '').toLowerCase();
  const downloadUrl = !isGit ? getAssetDownloadUrl(projectId, asset.id) : null;
  const name = isGit ? asset.repo_name : asset.file_name;
  const typeBadge = isGit ? 'Git Repo' : ((asset.file_type || 'file').toUpperCase() + ' File');
  const icon = isGit ? '📦' : getFileIconEmoji(ext);

  return (
    <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-200 bg-slate-50/80 shrink-0 gap-3 flex-wrap">
      <div className="flex items-center gap-3 min-w-0">
        <button 
          id="asset-viewer-back-btn" 
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 hover:text-slate-900 font-medium text-xs shadow-xs transition-colors cursor-pointer shrink-0"
        >
          <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/>
          </svg>
          <span>Back</span>
        </button>
        <span className="text-xl shrink-0">{icon}</span>
        <div className="min-w-0">
          <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate max-w-[55vw]">{name}</h1>
          <div className="flex gap-2 mt-1 flex-wrap items-center text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{typeBadge}</span>
            {asset.role_access && (
              <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded capitalize">
                Access: {asset.role_access.split(',').join(', ')}
              </span>
            )}
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded uppercase">
              Read Only
            </span>
            {asset.uploaded_at && (
              <span className="text-[11px] text-slate-400">Uploaded {new Date(asset.uploaded_at).toLocaleDateString()}</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {isGit && asset.repo_url && (
          <a 
            id="asset-viewer-open-repo-btn" 
            href={asset.repo_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
            </svg>
            <span>Open Repository</span>
          </a>
        )}
        {!isGit && downloadUrl && (
          <a 
            id="asset-viewer-download-btn" 
            href={downloadUrl} 
            download
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs transition-colors"
          >
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            <span>Download</span>
          </a>
        )}
      </div>
    </div>
  );
}

function PdfViewer({url}) {
  return <iframe src={url} title="PDF Viewer" style={{width:'100%',height:'100%',border:'none',display:'block'}}/>;
}

function ImageViewer({url, name}) {
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',background:'#f1f5f9',padding:32,overflow:'auto'}}>
      <img src={url} alt={name} style={{maxWidth:'100%',maxHeight:'100%',objectFit:'contain',borderRadius:8,boxShadow:'0 4px 24px rgba(0,0,0,0.10)',background:'white',border:'1px solid #e2e8f0'}}/>
    </div>
  );
}

function MarkdownViewer({content}) {
  if (content === null) return <LoadingSkeleton/>;
  return (
    <div style={{height:'100%',overflowY:'auto',padding:'32px 48px',background:'white'}}>
      <div style={{maxWidth:740,margin:'0 auto',lineHeight:1.75,color:'#1e293b',fontFamily:'system-ui,sans-serif'}}>
        <ReactMarkdown components={{
          h1:({children})=><h1 style={{fontSize:28,fontWeight:800,color:'#0f172a',marginBottom:16}}>{children}</h1>,
          h2:({children})=><h2 style={{fontSize:22,fontWeight:700,color:'#1e293b',marginBottom:12,marginTop:32}}>{children}</h2>,
          h3:({children})=><h3 style={{fontSize:18,fontWeight:700,color:'#334155',marginBottom:8,marginTop:24}}>{children}</h3>,
          p:({children})=><p style={{marginBottom:16,color:'#475569'}}>{children}</p>,
          code:({inline,children,className,...props})=>{
            if(inline) return <code style={{background:'#f1f5f9',padding:'1px 6px',borderRadius:4,fontFamily:'monospace',fontSize:'0.9em',color:'#e11d48'}}>{children}</code>;
            const match=/language-(\w+)/.exec(className||'');
            return <SyntaxHighlighter language={match?match[1]:'text'} style={vscDarkPlus} showLineNumbers customStyle={{borderRadius:8,fontSize:13,margin:'16px 0'}}>{String(children).replace(/\n$/,'')}</SyntaxHighlighter>;
          },
          blockquote:({children})=><blockquote style={{borderLeft:'4px solid #6366f1',paddingLeft:16,margin:'16px 0',color:'#64748b',fontStyle:'italic'}}>{children}</blockquote>,
          ul:({children})=><ul style={{paddingLeft:24,marginBottom:16}}>{children}</ul>,
          ol:({children})=><ol style={{paddingLeft:24,marginBottom:16}}>{children}</ol>,
          li:({children})=><li style={{marginBottom:4,color:'#475569'}}>{children}</li>,
          a:({href,children})=><a href={href} target="_blank" rel="noopener noreferrer" style={{color:'#4f46e5',textDecoration:'underline'}}>{children}</a>,
          hr:()=><hr style={{border:'none',borderTop:'1px solid #e2e8f0',margin:'24px 0'}}/>,
        }}>{content||''}</ReactMarkdown>
      </div>
    </div>
  );
}

function TextViewer({content}) {
  if (content === null) return <LoadingSkeleton/>;
  return (
    <div style={{height:'100%',overflowY:'auto',background:'#1e1e2e'}}>
      <pre style={{margin:0,padding:32,fontFamily:'"JetBrains Mono","Fira Code",monospace',fontSize:13,lineHeight:1.65,color:'#cdd6f4',whiteSpace:'pre-wrap',wordBreak:'break-all'}}>{content}</pre>
    </div>
  );
}

function CodeViewer({content, ext}) {
  if (content === null) return <LoadingSkeleton/>;
  const lang = LANG_MAP[ext] || 'text';
  return (
    <div style={{height:'100%',overflowY:'auto',display:'flex',flexDirection:'column'}}>
      <div style={{background:'#1e1e2e',padding:'8px 20px',borderBottom:'1px solid #313244',display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
        <span style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'#a6e3a1',fontFamily:'monospace'}}>{lang}</span>
        <span style={{color:'#45475a',fontSize:11}}>•</span>
        <span style={{color:'#6c7086',fontSize:11}}>syntax highlighting</span>
      </div>
      <SyntaxHighlighter language={lang} style={vscDarkPlus} showLineNumbers wrapLines
        lineNumberStyle={{minWidth:44,paddingRight:12,color:'#45475a',userSelect:'none'}}
        customStyle={{margin:0,flex:1,borderRadius:0,fontSize:13,lineHeight:1.65,background:'#1e1e2e',padding:'20px 0'}}
        codeTagProps={{style:{fontFamily:'"JetBrains Mono","Fira Code",monospace'}}}>
        {content||''}
      </SyntaxHighlighter>
    </div>
  );
}

function UnsupportedViewer({ext, downloadUrl}) {
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:16,background:'#f8fafc',textAlign:'center',padding:40}}>
      <div style={{fontSize:56}}>📎</div>
      <h3 style={{margin:'0 0 8px',fontSize:18,fontWeight:700,color:'#0f172a'}}>Preview not available</h3>
      <p style={{margin:'0 0 20px',fontSize:14,color:'#64748b'}}>{ext ? ('.' + ext.toUpperCase() + ' files') : 'This file type'} cannot be previewed in the browser.</p>
      <a id="asset-viewer-unsupported-download-btn" href={downloadUrl} download
        style={{display:'inline-flex',alignItems:'center',gap:8,padding:'10px 20px',borderRadius:8,fontSize:14,fontWeight:600,background:'#4f46e5',color:'white',textDecoration:'none'}}
        onMouseEnter={e=>{e.currentTarget.style.background='#4338ca';}}
        onMouseLeave={e=>{e.currentTarget.style.background='#4f46e5';}}>
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
        </svg>
        Download File
      </a>
    </div>
  );
}

export default function AssetViewerPage() {
  const { id: projectId, assetId } = useParams();
  const navigate = useNavigate();
  const [asset, setAsset] = useState(null);
  const [textContent, setTextContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { loadAsset(); }, [assetId, projectId]);

  const loadAsset = async () => {
    setLoading(true); setError(null); setTextContent(null);
    try {
      const metaRes = await documentService.getAssets(projectId);
      const allDocs = (metaRes.data.documents || []).map(d => ({...d, type:'document'}));
      const allRepos = (metaRes.data.git_repos || []).map(r => ({...r, type:'git_repo'}));
      const found = [...allDocs, ...allRepos].find(a => a.id === assetId);
      if (!found) { setError('Asset not found or you do not have access.'); setLoading(false); return; }
      setAsset(found);
      if (found.type !== 'git_repo') {
        const ext = (found.file_type || '').toLowerCase();
        const vt = getViewerType(ext);
        if (['text','code','markdown'].includes(vt)) {
          try {
            const r = await documentService.getAssetContent(projectId, assetId);
            setTextContent(typeof r.data === 'string' ? r.data : JSON.stringify(r.data, null, 2));
          } catch (contentErr) {
            console.error('Failed to load file content:', contentErr);
            setTextContent('// Could not load file content: ' + (contentErr.response?.data?.error || contentErr.message));
          }
        }
      }
    } catch(err) { setError(err.response?.data?.error || 'Failed to load asset.'); }
    finally { setLoading(false); }
  };

  const handleBack = () => navigate('/projects/' + projectId);

  const renderContent = () => {
    if (loading) return <LoadingSkeleton/>;
    if (error) return (
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:16,padding:40,textAlign:'center'}}>
        <div style={{fontSize:48}}>⚠️</div>
        <h3 style={{margin:0,fontSize:18,fontWeight:700,color:'#dc2626'}}>{error}</h3>
        <button onClick={handleBack} style={{padding:'8px 20px',borderRadius:8,border:'none',cursor:'pointer',background:'#4f46e5',color:'white',fontSize:14,fontWeight:600}}>
          Back to Project
        </button>
      </div>
    );
    if (!asset) return null;
    if (asset.type === 'git_repo') return (
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:16,background:'#f8fafc',padding:40,textAlign:'center'}}>
        <div style={{fontSize:56}}>📦</div>
        <h3 style={{margin:'0 0 8px',fontSize:20,fontWeight:700,color:'#0f172a'}}>{asset.repo_name}</h3>
        <p style={{margin:'0 0 6px',fontSize:13,color:'#64748b'}}>This is a Git Repository. Use the button above or below to open it.</p>
        {asset.repo_url && <p style={{margin:'0 0 20px',fontSize:12,color:'#94a3b8',fontFamily:'monospace'}}>{asset.repo_url}</p>}
        {asset.repo_url && (
          <a href={asset.repo_url} target="_blank" rel="noopener noreferrer"
            style={{display:'inline-flex',alignItems:'center',gap:8,padding:'10px 24px',borderRadius:8,fontSize:14,fontWeight:600,background:'#4f46e5',color:'white',textDecoration:'none'}}
            onMouseEnter={e=>{e.currentTarget.style.background='#4338ca';}}
            onMouseLeave={e=>{e.currentTarget.style.background='#4f46e5';}}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
            </svg>
            Open Repository
          </a>
        )}
      </div>
    );
    const ext = (asset.file_type || '').toLowerCase();
    const vt = getViewerType(ext);
    const contentUrl = getAssetContentUrl(projectId, asset.id);
    const downloadUrl = getAssetDownloadUrl(projectId, asset.id);
    if (vt === 'pdf')      return <PdfViewer url={contentUrl}/>;
    if (vt === 'image')    return <ImageViewer url={contentUrl} name={asset.file_name}/>;
    if (vt === 'markdown') return <MarkdownViewer content={textContent}/>;
    if (vt === 'text')     return <TextViewer content={textContent}/>;
    if (vt === 'code')     return <CodeViewer content={textContent} ext={ext}/>;
    return <UnsupportedViewer ext={ext} downloadUrl={downloadUrl}/>;
  };

  const pageTitle = asset ? (asset.type === 'git_repo' ? asset.repo_name : asset.file_name) : 'Asset Viewer';

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      <Header 
        projectName={pageTitle}
        subTitle="Asset Viewer"
        backTo={`/projects/${projectId}`}
        backLabel="Back to project"
      />
      <div className="flex flex-col flex-1 overflow-hidden m-3 sm:m-5 rounded-xl border border-slate-200 shadow-xs bg-white">
        <style>{'@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}'}</style>
        {loading && <div className="h-0.5 bg-indigo-600 animate-pulse shrink-0" />}
        {asset && !loading && !error && <TopBar asset={asset} projectId={projectId} onBack={handleBack}/>}
        <div className="flex-1 overflow-hidden relative">{renderContent()}</div>
      </div>
    </div>
  );
}
