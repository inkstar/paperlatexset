
import React, { useState } from 'react';
import { Copy, Check, Download, ExternalLink } from 'lucide-react';

interface Props {
  latexCode: string;
}

export const LatexOutput: React.FC<Props> = ({ latexCode }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(latexCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy!', err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([latexCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'exam_paper.tex';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleOpenOverleaf = () => {
    // Overleaf API form submission
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = 'https://www.overleaf.com/docs';
    form.target = '_blank';

    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'snip';
    input.value = latexCode;
    form.appendChild(input);

    const nameInput = document.createElement('input');
    nameInput.type = 'hidden';
    nameInput.name = 'snip_name';
    nameInput.value = 'exam_paper.tex';
    form.appendChild(nameInput);

    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  };

  return (
    <div className="flex flex-col h-full border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="font-semibold text-gray-700">生成的 LaTeX 代码</h3>
        <div className="flex gap-2">
          <button
            onClick={handleOpenOverleaf}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-[#47a141] rounded-md hover:bg-[#3d8b38] transition-colors"
          >
            <ExternalLink size={14} />
            Overleaf
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            <Download size={14} />
            .tex
          </button>
          <button
            onClick={handleCopy}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border transition-all duration-200
              ${copied 
                ? 'bg-green-50 text-green-700 border-green-200' 
                : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
              }
            `}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? '复制' : '复制'}
          </button>
        </div>
      </div>
      <div className="relative flex-1 bg-[#282c34] overflow-auto">
        <pre className="p-4 text-sm font-mono text-gray-300 leading-relaxed whitespace-pre-wrap break-all">
          {latexCode}
        </pre>
      </div>
    </div>
  );
};
