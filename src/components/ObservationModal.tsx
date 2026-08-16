import React, { useState, useEffect } from 'react';
import { Evaluation, Student } from '../types';
import { X, MessageSquare, Check, Plus } from 'lucide-react';

interface ObservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student;
  evaluation: Evaluation;
  onSave: (updatedEval: Evaluation) => void;
}

const QUICK_FEEDBACK_TAGS = [
  '+ Boa participação',
  '+ Demonstrou evolução',
  '+ Precisa aprofundar referências',
  '+ Participação limitada',
  '+ Dificuldade na formulação dos objetivos',
];

export const ObservationModal: React.FC<ObservationModalProps> = ({
  isOpen,
  onClose,
  student,
  evaluation,
  onSave,
}) => {
  const [teacherNotes, setTeacherNotes] = useState('');

  useEffect(() => {
    setTeacherNotes(evaluation.teacherNotes || evaluation.pedagogicalFeedback || '');
  }, [evaluation]);

  if (!isOpen) return null;

  const handleAddTag = (tagText: string) => {
    const cleanTag = tagText.replace(/^\+\s*/, '');
    if (!teacherNotes) {
      setTeacherNotes(cleanTag + '. ');
    } else {
      const trimmed = teacherNotes.trim();
      const endsWithPunct = /[.!?]$/.test(trimmed);
      setTeacherNotes(trimmed + (endsWithPunct ? ' ' : '. ') + cleanTag + '. ');
    }
  };

  const handleSave = () => {
    const updated: Evaluation = {
      ...evaluation,
      teacherNotes,
      updatedAt: new Date().toISOString().split('T')[0],
    };
    onSave(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl dark:bg-slate-900 dark:border dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <div>
              <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-100">
                Observação referente à Sessão Tutorial
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {student.name} • RA: {student.enrollment}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Quick Tags Section */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              ATALHOS FREQUENTES (CLIQUE PARA INSERIR):
            </label>
            <div className="flex flex-wrap gap-2">
              {QUICK_FEEDBACK_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleAddTag(tag)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-900 dark:hover:bg-indigo-950 dark:hover:text-indigo-200 transition-colors"
                >
                  <Plus className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                  <span>{tag.replace(/^\+\s*/, '')}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Comment Textarea */}
          <div>
            <textarea
              rows={4}
              maxLength={500}
              value={teacherNotes}
              onChange={(e) => setTeacherNotes(e.target.value)}
              placeholder="Digite observações específicas sobre a participação do aluno na sessão tutorial..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:border-indigo-600 focus:outline-hidden"
            />
            <div className="flex justify-end mt-1 text-[10px] text-slate-400">
              {teacherNotes.length} / 500 caracteres
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800 px-6 py-4 bg-slate-50/50 dark:bg-slate-800/50">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-900 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-800 transition-colors shadow-xs"
          >
            <Check className="h-4 w-4" />
            <span>Salvar Comentário</span>
          </button>
        </div>
      </div>
    </div>
  );
};
