import { Modal, Text } from '@mantine/core'
import './DeskModal.css'

export type DeskConfirmProps = {
  opened: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function DeskConfirm({
  opened,
  title,
  message,
  confirmLabel = '确定',
  cancelLabel = '取消',
  danger = false,
  onConfirm,
  onCancel,
}: DeskConfirmProps) {
  return (
    <Modal
      className="desk-modal"
      opened={opened}
      onClose={onCancel}
      title={title}
      centered
      radius="md"
      overlayProps={{ backgroundOpacity: 0.45, blur: 2 }}
      transitionProps={{ transition: 'pop', duration: 160 }}
    >
      <Text size="sm">{message}</Text>
      <div className="desk-modal__actions">
        <button type="button" className="desk-modal__btn" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={
            danger
              ? 'desk-modal__btn desk-modal__btn--danger'
              : 'desk-modal__btn desk-modal__btn--primary'
          }
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
