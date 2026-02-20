import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { UploadedFile } from '../types';
import { GripVertical, Trash2, FileText, Image as ImageIcon } from 'lucide-react';

interface Props {
  id: string;
  fileData: UploadedFile;
  onRemove: (id: string) => void;
  onPreview?: (url: string) => void;
  index: number;
}

export const SortableFileItem: React.FC<Props> = ({ id, fileData, onRemove, onPreview, index }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        relative flex items-center gap-4 p-3 bg-white rounded-lg border border-gray-200 shadow-sm
        group hover:border-blue-400 transition-colors
        ${isDragging ? 'opacity-50' : ''}
      `}
    >
      {/* Drag Handle */}
      <div 
        {...attributes} 
        {...listeners} 
        className="cursor-grab text-gray-400 hover:text-gray-600 active:cursor-grabbing p-1"
      >
        <GripVertical size={20} />
      </div>

      {/* Index Number */}
      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">
        {index + 1}
      </div>

      {/* Preview / Icon */}
      <div className="flex-shrink-0 w-12 h-12 bg-gray-100 rounded overflow-hidden flex items-center justify-center border border-gray-200">
        {fileData.type === 'image' && fileData.previewUrl ? (
          <img 
            src={fileData.previewUrl} 
            alt="preview" 
            className="w-full h-full object-cover cursor-zoom-in hover:opacity-90 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onPreview?.(fileData.previewUrl!);
            }}
          />
        ) : (
          <FileText className="text-gray-400" size={24} />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {fileData.file.name}
        </p>
        <p className="text-xs text-gray-500">
          {(fileData.file.size / 1024).toFixed(1)} KB • {fileData.type === 'image' ? '图片' : 'PDF'}
        </p>
      </div>

      {/* Actions */}
      <button
        onClick={() => onRemove(id)}
        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
        title="移除文件"
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
};
