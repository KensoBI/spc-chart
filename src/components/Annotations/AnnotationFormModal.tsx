import React, { useState, useCallback } from 'react';
import { dateTime } from '@grafana/data';
import { Modal, Field, TextArea, TagsInput, Button, Alert, useTheme2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { createAnnotation, updateAnnotation } from './annotationApi';
import { CreateAnnotationPayload, UpdateAnnotationPayload } from './types';

interface AnnotationFormModalProps {
  isOpen: boolean;
  time: number;
  panelId?: number;
  dashboardUID?: string;
  onDismiss: () => void;
  onSuccess: (updatedData?: { id: number; text: string; tags?: string[]; time?: number }) => void;
  // New props for edit mode
  mode?: 'create' | 'edit';
  annotationId?: number;
  initialText?: string;
  initialTags?: string[];
}

// Create a unique key for resetting state when modal opens with different data
const ModalContent: React.FC<Omit<AnnotationFormModalProps, 'isOpen'>> = ({
  time,
  panelId,
  dashboardUID,
  onDismiss,
  onSuccess,
  mode = 'create',
  annotationId,
  initialText = '',
  initialTags = [],
}) => {
  const theme = useTheme2();
  const [description, setDescription] = useState(initialText);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formattedTime = dateTime(time).format('YYYY-MM-DD HH:mm:ss');

  const handleSubmit = useCallback(async () => {
    // Validate description
    if (!description.trim()) {
      setError('Description is required');
      return;
    }

    // Validate annotation ID for edit mode
    if (mode === 'edit' && !annotationId) {
      setError('Annotation ID is required for editing');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      if (mode === 'edit' && annotationId) {
        // Update existing annotation
        const payload: UpdateAnnotationPayload = {
          text: description.trim(),
          tags: tags.length > 0 ? tags : undefined,
        };
        await updateAnnotation(annotationId, payload);

        // Pass updated data to callback
        const updatedData = {
          id: annotationId,
          text: description.trim(),
          tags: tags.length > 0 ? tags : undefined,
        };

        // Reset form and call success callback with updated data
        setDescription('');
        setTags([]);
        setIsSubmitting(false);
        onSuccess(updatedData);
        onDismiss();
      } else {
        // Create new annotation
        const payload: CreateAnnotationPayload = {
          text: description.trim(),
          time,
          tags: tags.length > 0 ? tags : undefined,
          dashboardUID,
          panelId,
        };
        const response = await createAnnotation(payload);

        // Pass created annotation data to callback with time
        const createdData = {
          id: response.id,
          text: description.trim(),
          tags: tags.length > 0 ? tags : undefined,
          time: time, // Include the time for create operations
        };

        // Reset form and call success callback with created data
        setDescription('');
        setTags([]);
        setIsSubmitting(false);
        onSuccess(createdData);
        onDismiss();
      }
    } catch (err) {
      setIsSubmitting(false);
      setError(err instanceof Error ? err.message : `Failed to ${mode === 'edit' ? 'update' : 'create'} annotation`);
    }
  }, [description, time, tags, dashboardUID, panelId, mode, annotationId, onSuccess, onDismiss]);

  const handleCancel = useCallback(() => {
    setDescription('');
    setTags([]);
    setError(null);
    onDismiss();
  }, [onDismiss]);

  return (
    <Modal
      title={mode === 'edit' ? 'Edit Annotation' : 'Add Annotation'}
      isOpen={true}
      onDismiss={handleCancel}
      className={css({
        width: '500px',
      })}
    >
      <div
        className={css({
          padding: theme.spacing(2),
        })}
      >
        {error && (
          <Alert
            title="Error"
            severity="error"
            className={css({
              marginBottom: theme.spacing(2),
            })}
          >
            {error}
          </Alert>
        )}

        <Field label="Time" description="Timestamp for this annotation">
          <div
            className={css({
              padding: theme.spacing(1),
              background: theme.colors.background.secondary,
              borderRadius: theme.shape.radius.default,
              fontSize: theme.typography.bodySmall.fontSize,
              color: theme.colors.text.primary,
            })}
          >
            {formattedTime}
          </div>
        </Field>

        <Field
          label="Description"
          description="Annotation text"
          required
          invalid={error !== null && !description.trim()}
        >
          <TextArea
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
            placeholder="Enter annotation description..."
            rows={4}
            disabled={isSubmitting}
          />
        </Field>

        <Field label="Tags" description="Optional tags for categorization">
          <TagsInput tags={tags} onChange={setTags} disabled={isSubmitting} />
        </Field>

        <div
          className={css({
            display: 'flex',
            justifyContent: 'flex-end',
            gap: theme.spacing(1),
            marginTop: theme.spacing(2),
          })}
        >
          <Button variant="secondary" onClick={handleCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export const AnnotationFormModal: React.FC<AnnotationFormModalProps> = ({ isOpen, ...props }) => {
  if (!isOpen) {
    return null;
  }

  // Use a key to reset state when switching between annotations
  const key = `${props.mode}-${props.annotationId || props.time}`;

  return <ModalContent key={key} {...props} />;
};
