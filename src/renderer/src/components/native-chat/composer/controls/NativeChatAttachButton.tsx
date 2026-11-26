import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslate } from '@/i18n/use-translate'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu'

export type NativeChatAddMenu = {
  photos: () => void
  files?: () => void
  skills?: () => void
  commands?: () => void
}

/** The composer's + button: picks files to attach. */
export function NativeChatAttachButton({
  disabled,
  onAttach,
  menu
}: {
  disabled?: boolean
  onAttach: () => void
  menu?: NativeChatAddMenu
}): React.JSX.Element {
  const t = useTranslate()
  if (menu) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            aria-label={t('components.native-chat.composer.attach', 'Attach file')}
          >
            <Plus className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start">
          <DropdownMenuItem onSelect={menu.photos}>
            {t('bots.groups.addPhotos', 'Photos')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onAttach}>
            {t('bots.groups.addFiles', 'Files (PDF, text, code)')}
          </DropdownMenuItem>
          {menu.files && (
            <DropdownMenuItem onSelect={menu.files}>
              {t('bots.groups.addWorkspaceFiles', 'Workspace files')}
            </DropdownMenuItem>
          )}
          {menu.skills && (
            <DropdownMenuItem onSelect={menu.skills}>
              {t('bots.groups.addSkills', 'Skills')}
            </DropdownMenuItem>
          )}
          {menu.commands && (
            <DropdownMenuItem onSelect={menu.commands}>
              {t('bots.groups.addCommands', 'Commands')}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t('components.native-chat.composer.attach', 'Attach file')}
          disabled={disabled}
          onClick={onAttach}
          className="pointer-coarse:size-11"
        >
          <Plus className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        {t('components.native-chat.composer.attach', 'Attach file')}
      </TooltipContent>
    </Tooltip>
  )
}
