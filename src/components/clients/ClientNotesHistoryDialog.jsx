import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip } from '@/components/ui/tooltip';
import { clientService } from '@/services';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Loader2, Pencil, StickyNote, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { normalizeNotesHistory } from '@/utils/clientNotesHistory';

/**
 * View (and optionally append) client notes history.
 * @param {boolean} allowAdd — when true, show add-note UI (Clients page and Service Request form).
 */
export default function ClientNotesHistoryDialog({
  open,
  onOpenChange,
  clientId,
  clientName = '',
  allowAdd = false,
  onClientUpdated,
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [editingNewest, setEditingNewest] = useState(false);
  const [editText, setEditText] = useState('');

  const { data: client, isLoading, refetch } = useQuery({
    queryKey: ['clients', clientId, 'notes'],
    queryFn: () => clientService.getById(clientId),
    enabled: open && !!clientId,
  });

  useEffect(() => {
    if (!open) {
      setDraft('');
      setEditingNewest(false);
      setEditText('');
    }
  }, [open]);

  const history = normalizeNotesHistory(client?.notes_history);

  const appendMutation = useMutation({
    mutationFn: (text) => clientService.appendNotesHistoryEntry(clientId, text),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setDraft('');
      refetch();
      if (onClientUpdated && updated) onClientUpdated(updated);
      toast.success('Note added to history');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to save note');
    },
  });

  const updateNewestMutation = useMutation({
    mutationFn: (text) => clientService.updateNewestNotesHistoryEntry(clientId, text),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setEditingNewest(false);
      setEditText('');
      refetch();
      if (onClientUpdated && updated) onClientUpdated(updated);
      toast.success('Note updated');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update note');
    },
  });

  const deleteNewestMutation = useMutation({
    mutationFn: () => clientService.deleteNewestNotesHistoryEntry(clientId),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setEditingNewest(false);
      setEditText('');
      refetch();
      if (onClientUpdated && updated) onClientUpdated(updated);
      toast.success('Note removed');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to delete note');
    },
  });

  const handleAdd = () => {
    const t = draft.trim();
    if (!t) {
      toast.error('Enter a note');
      return;
    }
    appendMutation.mutate(t);
  };

  const handleSaveEditNewest = () => {
    const t = editText.trim();
    if (!t) {
      toast.error('Enter a note');
      return;
    }
    updateNewestMutation.mutate(t);
  };

  const handleDeleteNewest = () => {
    if (!window.confirm('Remove the newest note from history?')) return;
    deleteNewestMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5 text-primary" />
            Notes history
          </DialogTitle>
          <DialogDescription>
            {clientName ? (
              <span className="text-gray-700 font-medium">{clientName}</span>
            ) : (
              'Chronological notes for this client'
            )}
          </DialogDescription>
        </DialogHeader>

        {allowAdd && (
          <div className="px-6 pb-3 space-y-2 border-b border-gray-100 shrink-0">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add a new note to history..."
              rows={3}
              className="resize-y min-h-[72px] text-sm"
            />
            <Button
              type="button"
              size="sm"
              className="bg-primary hover:bg-primary/90"
              disabled={appendMutation.isPending || !draft.trim()}
              onClick={handleAdd}
            >
              {appendMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving
                </>
              ) : (
                'Add to history'
              )}
            </Button>
          </div>
        )}

        <div className="flex-1 min-h-0 px-6 py-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No notes in history yet.
              {allowAdd ? ' Add one above.' : ''}
            </p>
          ) : (
            <ScrollArea className="h-[min(50vh,320px)] pr-3">
              <ul className="space-y-3">
                {history.map((entry, index) => {
                  const isNewest = index === 0;
                  const key = entry.id || `${entry.created_at}-${entry.text.slice(0, 20)}`;
                  return (
                    <li
                      key={key}
                      className="rounded-lg border border-gray-100 bg-gray-50/80 p-3 text-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground mb-1.5 tabular-nums">
                            {entry.created_at
                              ? format(new Date(entry.created_at), 'MMM d, yyyy · h:mm a')
                              : '—'}
                          </p>
                          {isNewest && editingNewest ? (
                            <div className="space-y-2">
                              <Textarea
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                rows={4}
                                className="resize-y min-h-[88px] text-sm"
                              />
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  className="bg-primary hover:bg-primary/90"
                                  disabled={updateNewestMutation.isPending || !editText.trim()}
                                  onClick={handleSaveEditNewest}
                                >
                                  {updateNewestMutation.isPending ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      Saving
                                    </>
                                  ) : (
                                    'Save'
                                  )}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={updateNewestMutation.isPending}
                                  onClick={() => {
                                    setEditingNewest(false);
                                    setEditText('');
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-gray-900 whitespace-pre-wrap break-words">{entry.text}</p>
                          )}
                        </div>
                        {isNewest && !editingNewest && (
                          <div className="flex shrink-0 gap-0.5">
                            <Tooltip.Root>
                              <Tooltip.Trigger asChild>
                                <span className="inline-flex">
                                  <Button
                                    type="button"
                                    variant="default"
                                    size="icon"
                                    className="h-8 w-8 shadow-sm"
                                    aria-label="Edit"
                                    disabled={
                                      appendMutation.isPending ||
                                      updateNewestMutation.isPending ||
                                      deleteNewestMutation.isPending
                                    }
                                    onClick={() => {
                                      setEditingNewest(true);
                                      setEditText(entry.text);
                                    }}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </span>
                              </Tooltip.Trigger>
                              <Tooltip.Portal>
                                <Tooltip.Content side="top" sideOffset={5}>
                                  Edit
                                  <Tooltip.Arrow />
                                </Tooltip.Content>
                              </Tooltip.Portal>
                            </Tooltip.Root>
                            <Tooltip.Root>
                              <Tooltip.Trigger asChild>
                                <span className="inline-flex">
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="icon"
                                    className="h-8 w-8 bg-red-600 text-white hover:bg-red-700 shadow-sm"
                                    aria-label="Delete"
                                    disabled={
                                      appendMutation.isPending ||
                                      updateNewestMutation.isPending ||
                                      deleteNewestMutation.isPending
                                    }
                                    onClick={handleDeleteNewest}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </span>
                              </Tooltip.Trigger>
                              <Tooltip.Portal>
                                <Tooltip.Content side="top" sideOffset={5}>
                                  Delete
                                  <Tooltip.Arrow />
                                </Tooltip.Content>
                              </Tooltip.Portal>
                            </Tooltip.Root>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-100 shrink-0">
          <Button type="button" variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
