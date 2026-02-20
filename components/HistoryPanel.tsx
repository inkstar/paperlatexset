
import React from 'react';
import { HistoryRecord } from '../types';
import { X, Clock, FileText, RotateCcw, Trash2, Calendar } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryRecord[];
  onRestore: (record: HistoryRecord) => void;
  onClear: () => void;
  onDelete: (id: string) => void;
}

export const HistoryPanel: React.FC<Props> = ({ 
  isOpen, 
  onClose, 
  history, 
  onRestore, 
  onClear,
  onDelete
}) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-white shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2 text-gray-800">
            <Clock size={20} className="text-blue-600" />
            <h2 className="font-semibold text-lg">历史记录</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-gray-200 rounded-full text-gray-500 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
              <Calendar size={40} className="opacity-20" />
              <p>暂无历史记录</p>
            </div>
          ) : (
            history.map((record) => (
              <div 
                key={record.id}
                className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow group relative"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                    {new Date(record.timestamp).toLocaleDateString()} {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(record.id); }}
                    className="text-gray-300 hover:text-red-500 transition-colors p-1"
                    title="删除此条"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                
                <h3 className="text-sm font-semibold text-gray-800 mb-1 line-clamp-1">
                  {record.title}
                </h3>
                
                <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
                  <FileText size={12} />
                  <span className="truncate max-w-[200px]">
                     {record.fileNames.length > 0 ? record.fileNames.join(', ') : '无文件名'}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
                  {record.options.sortByType && <span className="border px-1.5 py-0.5 rounded">按题型分类</span>}
                  {record.options.keepOriginalNumbers && <span className="border px-1.5 py-0.5 rounded">保持题号</span>}
                </div>

                <button
                  onClick={() => onRestore(record)}
                  className="w-full flex items-center justify-center gap-2 bg-gray-50 hover:bg-blue-50 text-gray-700 hover:text-blue-700 border border-gray-200 hover:border-blue-200 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <RotateCcw size={14} />
                  恢复并查看
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {history.length > 0 && (
          <div className="p-4 border-t border-gray-200 bg-white">
            <button
              onClick={onClear}
              className="w-full flex items-center justify-center gap-2 text-red-600 hover:bg-red-50 py-2 rounded-lg text-sm transition-colors"
            >
              <Trash2 size={16} />
              清空所有记录
            </button>
          </div>
        )}
      </div>
    </>
  );
};
