import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { DndProvider, useDrag, useDrop, DragSourceMonitor } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import {
  openDashboardWindow,
  openTasksWindow,
  openDocumentsWindow,
  openNotificationWindow,
  openObjectManagerWindow,
  openCalendarWindow,
  openReconstructionWindow,
  openSpacesWindow,
  openMoreElementsWindow,
  closeMoreElementsWindow,
  closeAllModals,
} from '../../store/modalSlice.ts';
import { RootState } from '../../store/store';
import { useMatterport } from '../../contexts/MatterportContext';
import { useSpace } from '../../contexts/SpaceContext';
import {
  Box,
  Paper,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Typography,
  TextField,
  InputAdornment,
  styled,
} from '@mui/material';
import { Dialog } from '../../components/Dialog';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import DesignServicesIcon from '@mui/icons-material/DesignServices';
import TakeoutDiningIcon from '@mui/icons-material/TakeoutDining';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import type { SvgIconProps } from '@mui/material';
import {
  useGetUserMenuQuery,
  useGetMenuCatalogQuery,
  MenuCatalogItem,
  useUpdateUserMenuMutation,
  UserMenuPayload,
} from '../../api/userMenu/userMenuApi';

interface MenuItem {
  id: string;
  icon?: string;
  iconKey: string;
  muiIcon?: React.ComponentType<SvgIconProps>;
  label: string;
  section: 'main' | 'other';
  order: number;
}

const DND_TYPE = 'MENU_ITEM';

const fallbackMenuCatalog: MenuCatalogItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    iconKey: 'dashboard',
    defaultSection: 'main',
    defaultOrder: 0,
  },
  { id: 'objects', label: 'Objects', iconKey: 'objects', defaultSection: 'main', defaultOrder: 1 },
  { id: 'tasks', label: 'Tasks', iconKey: 'tasks', defaultSection: 'main', defaultOrder: 2 },
  {
    id: 'notifications',
    label: 'Notifications',
    iconKey: 'notifications',
    defaultSection: 'main',
    defaultOrder: 3,
  },
  {
    id: 'calendar',
    label: 'Calendar',
    iconKey: 'calendar',
    defaultSection: 'main',
    defaultOrder: 4,
  },
  {
    id: 'documents',
    label: 'Documents',
    iconKey: 'documents',
    defaultSection: 'main',
    defaultOrder: 5,
  },
  { id: 'profile', label: 'Profile', iconKey: 'profile', defaultSection: 'main', defaultOrder: 6 },
  {
    id: 'interior-designer',
    label: 'Interior Designer',
    iconKey: 'interior-designer',
    defaultSection: 'other',
    defaultOrder: 0,
  },
  {
    id: 'food-delivery',
    label: 'Food Delivery',
    iconKey: 'food-delivery',
    defaultSection: 'other',
    defaultOrder: 1,
  },
  {
    id: 'insurance',
    label: 'Insurance',
    iconKey: 'insurance',
    defaultSection: 'other',
    defaultOrder: 2,
  },
  { id: 'games', label: 'Games', iconKey: 'games', defaultSection: 'other', defaultOrder: 3 },
  {
    id: 'reconstruction',
    label: '3D Reconstruction',
    iconKey: 'reconstruction',
    defaultSection: 'other',
    defaultOrder: 4,
  },
  { id: 'spaces', label: 'My Spaces', iconKey: 'spaces', defaultSection: 'main', defaultOrder: 7 },
];

const menuIconMetadata: Record<
  string,
  { icon?: string; muiIcon?: React.ComponentType<SvgIconProps> }
> = {
  dashboard: { icon: '/icons/menu/white/dashboard.svg' },
  objects: { icon: '/icons/menu/white/objects.svg' },
  tasks: { icon: '/icons/menu/white/tasks.svg' },
  notifications: { icon: '/icons/menu/white/notifications.svg' },
  calendar: { icon: '/icons/menu/white/calendar.svg' },
  documents: { icon: '/icons/menu/white/documents.svg' },
  profile: { icon: '/icons/menu/white/profile.svg' },
  'interior-designer': { muiIcon: DesignServicesIcon },
  'food-delivery': { muiIcon: TakeoutDiningIcon },
  insurance: { muiIcon: HealthAndSafetyIcon },
  games: { muiIcon: SportsEsportsIcon },
  reconstruction: { icon: '/icons/menu/white/3d-reconstruction.svg' },
  spaces: { muiIcon: HomeWorkIcon },
};

const legacyMenuNameToId: Record<string, string> = {
  Dashboard: 'dashboard',
  Objects: 'objects',
  Tasks: 'tasks',
  Notifications: 'notifications',
  Calendar: 'calendar',
  Documents: 'documents',
  Profile: 'profile',
  'Interior Designer': 'interior-designer',
  'Food Delivery': 'food-delivery',
  Insurance: 'insurance',
  Games: 'games',
  '3D Reconstruction': 'reconstruction',
  'My Spaces': 'spaces',
  'AI Agent': 'dashboard',
};

function createMenuItemsFromCatalog(catalog: MenuCatalogItem[]): MenuItem[] {
  return catalog.map(item => ({
    id: item.id,
    iconKey: item.iconKey,
    icon: menuIconMetadata[item.iconKey]?.icon,
    muiIcon: menuIconMetadata[item.iconKey]?.muiIcon,
    label: item.label,
    section: item.defaultSection,
    order: item.defaultOrder,
  }));
}

// --- Styled Components ---

const StyledPaper = styled(Paper)({
  width: 64,
  borderRadius: 34,
  padding: 12,
  background: 'var(--Back, #2E2E2E59)',
  backdropFilter: 'blur(100px)',
  WebkitBackdropFilter: 'blur(100px)',
  transition: 'all 0.3s ease',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  boxShadow: 'none',
  '&.expanded': {
    width: 184,
    '& .MuiListItem': {
      width: '100%',
    },
    '& .MuiListItemText-primary': {
      transform: 'scaleX(1)',
      opacity: 1,
    },
  },
});

const ShortcutPaper = styled(Paper)({
  width: 64,
  borderRadius: 34,
  padding: 12,
  background: 'var(--Back, #2E2E2E59)',
  backdropFilter: 'blur(100px)',
  WebkitBackdropFilter: 'blur(100px)',
  transition: 'all 0.3s ease',
  boxShadow: 'none',
  '&.expanded': {
    width: 184,
    '& .MuiListItem': {
      width: '100%',
    },
    '& .MuiListItemText-primary': {
      transform: 'scaleX(1)',
      opacity: 1,
    },
  },
});

const StyledListItem = styled(ListItem)({
  borderRadius: 20,
  color: 'white',
  justifyContent: 'center',
  alignItems: 'center',
  opacity: 0.75,
  padding: '8px',
  width: '100%',
  height: 40,
  minHeight: 40,
  transition: 'all 0.3s ease',
  cursor: 'grab',
  display: 'flex',
  gap: '8px',
  '&:hover': {
    opacity: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  '&.selected': {
    backgroundColor: 'white',
    opacity: 1,
    '& .MuiListItemText-primary': {
      color: 'black',
    },
    '& img, & .MuiSvgIcon-root': {
      filter: 'brightness(0)',
    },
  },
});

const StaticListItem = styled(StyledListItem)({
  cursor: 'default',
  opacity: 1,
  justifyContent: 'flex-start',
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
});

const StyledListItemText = styled(ListItemText)({
  margin: 0,
  '& .MuiListItemText-primary': {
    transform: 'scaleX(0)',
    opacity: 0,
    transition: 'all 0.3s ease',
    transformOrigin: 'left',
    whiteSpace: 'nowrap',
    color: 'white',
    fontSize: '14px',
    lineHeight: '20px',
  },
});

const StyledListItemIcon = styled(ListItemIcon)({
  width: 24,
  height: 24,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minWidth: 'auto',
  marginRight: 0,
  flexShrink: 0,
  padding: 0,
});

const SidebarStack = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
});

const Icon = styled('img')({
  width: 24,
  height: 24,
});

const MuiMenuIcon = styled('span')({
  width: 24,
  height: 24,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  '& .MuiSvgIcon-root': {
    width: 20,
    height: 20,
    fill: 'white',
  },
});

function MenuItemIcon({ item }: { item: MenuItem }) {
  if (item.muiIcon) {
    const MuiComp = item.muiIcon;
    return (
      <MuiMenuIcon>
        <MuiComp sx={{ fontSize: 20, fill: 'white' }} />
      </MuiMenuIcon>
    );
  }
  return <Icon src={item.icon} alt={item.label} />;
}

// Global pulse animation
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    @keyframes pulse {
      0% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(1.1); }
      100% { opacity: 1; transform: scale(1); }
    }
  `;
  if (!document.querySelector('[data-menu-pulse]')) {
    styleElement.setAttribute('data-menu-pulse', 'true');
    document.head.appendChild(styleElement);
  }
}

// --- Interfaces ---

interface DragItem {
  id: string;
  index: number;
  sourceList: string;
  moved?: boolean;
}

// --- DropZone Component (between items) ---

interface DropZoneProps {
  targetList: string;
  targetIndex: number;
  onDrop: (
    sourceList: string,
    sourceIndex: number,
    targetList: string,
    targetIndex: number
  ) => void;
}

function DropZone({ targetList, targetIndex, onDrop }: DropZoneProps) {
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: DND_TYPE,
    collect: monitor => ({
      isOver: monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop(),
    }),
    drop: (item: DragItem) => {
      if (item.sourceList === targetList && item.index === targetIndex) return;
      if (item.sourceList === targetList && item.index === targetIndex - 1) return;
      onDrop(item.sourceList, item.index, targetList, targetIndex);
    },
  });

  const active = isOver && canDrop;

  return (
    <div
      ref={drop}
      style={{
        height: active ? '16px' : '4px',
        borderRadius: '8px',
        backgroundColor: active ? 'rgba(255, 255, 255, 0.45)' : 'transparent',
        boxShadow: active ? '0 0 8px rgba(255, 255, 255, 0.3)' : 'none',
        transition: 'all 0.2s ease',
        flexShrink: 0,
        margin: active ? '2px 0' : '0',
      }}
    />
  );
}

// --- DraggableMenuItem Component ---

interface DraggableMenuItemProps {
  item: MenuItem;
  index: number;
  listType: string;
  onItemClick: (id: string) => void;
  isOpen: boolean;
  isObjectsOpen: boolean;
  isWide: boolean;
  layout?: 'list' | 'grid';
  onHoverMove?: (
    sourceList: string,
    sourceIndex: number,
    targetList: string,
    targetIndex: number
  ) => void;
  onDragStart?: () => void;
  onDragEnd?: (didDrop: boolean, moved: boolean) => void;
}

function DraggableMenuItem({
  item,
  index,
  listType,
  onItemClick,
  isOpen,
  isObjectsOpen,
  isWide,
  layout = 'list',
  onHoverMove,
  onDragStart,
  onDragEnd,
}: DraggableMenuItemProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [{ isDragging }, drag] = useDrag({
    type: DND_TYPE,
    item: () => {
      onDragStart?.();
      return { id: item.id, index, sourceList: listType, moved: false };
    },
    end: (draggedItem, monitor) => {
      onDragEnd?.(monitor.didDrop(), Boolean(draggedItem?.moved));
    },
    collect: (monitor: DragSourceMonitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const { activeSpace } = useSpace();
  const isSelected =
    (item.id === 'dashboard' && isOpen) || (item.id === 'objects' && isObjectsOpen);
  const subtitle = item.id === 'spaces' && activeSpace ? activeSpace.name : undefined;

  const [, drop] = useDrop({
    accept: DND_TYPE,
    hover: (draggedItem: DragItem, monitor) => {
      if (!ref.current || !onHoverMove) return;

      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;

      const hoverRect = ref.current.getBoundingClientRect();
      const hoverMiddleX = (hoverRect.right - hoverRect.left) / 2;
      const hoverMiddleY = (hoverRect.bottom - hoverRect.top) / 2;
      const hoverClientX = clientOffset.x - hoverRect.left;
      const hoverClientY = clientOffset.y - hoverRect.top;
      const sameList = draggedItem.sourceList === listType;

      if (sameList && draggedItem.index === index) return;

      const insertAfter =
        layout === 'grid' && sameList && Math.floor(draggedItem.index / 3) === Math.floor(index / 3)
          ? hoverClientX > hoverMiddleX
          : hoverClientY > hoverMiddleY;

      const targetIndex = index + (insertAfter ? 1 : 0);
      if (sameList && draggedItem.index < targetIndex && draggedItem.index + 1 === targetIndex) {
        return;
      }
      if (sameList && draggedItem.index === targetIndex) {
        return;
      }

      onHoverMove(draggedItem.sourceList, draggedItem.index, listType, targetIndex);
      draggedItem.sourceList = listType;
      draggedItem.index =
        sameList && draggedItem.index < targetIndex ? targetIndex - 1 : targetIndex;
      draggedItem.moved = true;
    },
    drop: () => ({ handled: true }),
  });
  drag(drop(ref));

  if (layout === 'grid') {
    return (
      <Box
        ref={ref}
        sx={{
          opacity: isDragging ? 0.4 : 1,
          cursor: 'grab',
          transform: isDragging ? 'scale(1.06)' : 'scale(1)',
          transition: 'transform 0.24s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s ease',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.5,
            p: 1,
            borderRadius: 3,
            opacity: isSelected ? 1 : 0.75,
            backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.18)' : 'transparent',
            '&:hover': { opacity: 1, backgroundColor: 'rgba(255, 255, 255, 0.1)' },
            minWidth: 56,
            transition:
              'transform 0.24s cubic-bezier(0.22, 1, 0.36, 1), background-color 0.2s ease, opacity 0.2s ease',
          }}
          onClick={() => onItemClick(item.id)}
        >
          <MenuItemIcon item={item} />
          <Typography
            sx={{
              color: 'white',
              fontSize: 10,
              lineHeight: '12px',
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            {item.label}
          </Typography>
          {subtitle && (
            <Typography
              sx={{
                color: 'rgba(255,255,255,0.45)',
                fontSize: 8,
                lineHeight: '10px',
                textAlign: 'center',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 56,
              }}
            >
              {subtitle}
            </Typography>
          )}
        </Box>
      </Box>
    );
  }

  return (
    <div
      ref={ref}
      style={{
        opacity: isDragging ? 0.4 : 1,
        cursor: 'grab',
        transform: isDragging ? 'scale(1.03)' : 'scale(1)',
        transition: 'transform 0.24s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s ease',
      }}
    >
      <StyledListItem
        onClick={() => onItemClick(item.id)}
        className={isSelected ? 'selected' : ''}
        sx={{
          transition:
            'transform 0.24s cubic-bezier(0.22, 1, 0.36, 1), background-color 0.2s ease, opacity 0.2s ease, box-shadow 0.2s ease',
        }}
      >
        <StyledListItemIcon>
          <MenuItemIcon item={item} />
        </StyledListItemIcon>
        {isWide && <StyledListItemText primary={item.label} />}
      </StyledListItem>
    </div>
  );
}

// --- DroppableMoreButton Component (uses useDrop, must be inside DndProvider) ---

interface DroppableMoreButtonProps {
  onClick: () => void;
  isWide: boolean;
  onDropToOther: (sourceList: string, sourceIndex: number) => void;
  onOpenMore: () => void;
  setIsWide: (isWide: boolean) => void;
}

function DroppableMoreButton({
  onClick,
  isWide,
  onDropToOther,
  onOpenMore,
  setIsWide,
}: DroppableMoreButtonProps) {
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: DND_TYPE,
    collect: monitor => ({
      isOver: monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop(),
    }),
    drop: (item: DragItem) => {
      onOpenMore();
      setIsWide(true);
      if (item.sourceList !== 'other') {
        onDropToOther(item.sourceList, item.index);
      }
    },
  });

  return (
    <div ref={drop}>
      <StyledListItem
        onClick={onClick}
        sx={{
          justifyContent: 'flex-start',
          backgroundColor: isOver && canDrop ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
          boxShadow: isOver && canDrop ? '0 0 12px rgba(255, 255, 255, 0.3)' : 'none',
          transition: 'all 0.2s ease',
        }}
      >
        <StyledListItemIcon>
          <Icon src="/icons/menu/plus.svg" alt="More" />
        </StyledListItemIcon>
        {isWide && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <StyledListItemText primary={isOver && canDrop ? 'Drop here' : 'More'} />
          </Box>
        )}
      </StyledListItem>
    </div>
  );
}

// --- DroppableList Component ---

interface DroppableListProps {
  items: MenuItem[];
  listType: string;
  onItemClick: (id: string) => void;
  isOpen: boolean;
  isObjectsOpen: boolean;
  isWide: boolean;
  onDrop: (
    sourceList: string,
    sourceIndex: number,
    targetList: string,
    targetIndex: number
  ) => void;
  layout?: 'list' | 'grid';
  onHoverMove?: (
    sourceList: string,
    sourceIndex: number,
    targetList: string,
    targetIndex: number
  ) => void;
  onDragStart?: () => void;
  onDragEnd?: (didDrop: boolean, moved: boolean) => void;
}

function DroppableList({
  items,
  listType,
  onItemClick,
  isOpen,
  isObjectsOpen,
  isWide,
  onDrop,
  layout = 'list',
  onHoverMove,
  onDragStart,
  onDragEnd,
}: DroppableListProps) {
  if (layout === 'grid') {
    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, p: 0.5 }}>
        {items.map((item, index) => (
          <Box key={item.id} sx={{ minWidth: 0 }}>
            <DraggableMenuItem
              item={item}
              index={index}
              listType={listType}
              onItemClick={onItemClick}
              isOpen={isOpen}
              isObjectsOpen={isObjectsOpen}
              isWide={isWide}
              layout="grid"
              onHoverMove={onHoverMove}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      {items.map((item, index) => (
        <Box key={item.id}>
          <DraggableMenuItem
            item={item}
            index={index}
            listType={listType}
            onItemClick={onItemClick}
            isOpen={isOpen}
            isObjectsOpen={isObjectsOpen}
            isWide={isWide}
            onHoverMove={onHoverMove}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        </Box>
      ))}
      <DropZone targetList={listType} targetIndex={items.length} onDrop={onDrop} />
    </Box>
  );
}

// --- Main Menu Component ---

export function Menu() {
  const dispatch = useDispatch();
  const { activeSpaceId } = useSpace();
  const { isOpen } = useSelector((state: RootState) => state.modal.dashboardWindowModal);
  const { isOpen: isObjectsOpen } = useSelector(
    (state: RootState) => state.modal.objectManagerWindowModal
  );
  const { isOpen: isMoreElementsOpen } = useSelector(
    (state: RootState) => state.modal.moreElementsWindowModal
  );
  const { isLoading: isMatterportLoading } = useMatterport();

  const { data: userMenuData, isLoading: isLoadingUserMenu } = useGetUserMenuQuery();
  const { data: menuCatalogData } = useGetMenuCatalogQuery();
  const [updateUserMenu] = useUpdateUserMenuMutation();

  const baseCatalog = useMemo(
    () =>
      menuCatalogData?.data && menuCatalogData.data.length > 0
        ? menuCatalogData.data
        : fallbackMenuCatalog,
    [menuCatalogData]
  );
  const defaultMenuItems = useMemo(() => createMenuItemsFromCatalog(baseCatalog), [baseCatalog]);

  const [customMenuItems, setCustomMenuItems] = useState<MenuItem[]>(defaultMenuItems);
  const [isWide, setIsWide] = useState(false);
  const [moreSearch, setMoreSearch] = useState('');
  const isUpdatingUserMenu = useRef(false);
  const customMenuItemsRef = useRef<MenuItem[]>(defaultMenuItems);
  const dragSnapshotRef = useRef<MenuItem[] | null>(null);

  useEffect(() => {
    customMenuItemsRef.current = customMenuItems;
  }, [customMenuItems]);

  const getSectionItems = useCallback(
    (items: MenuItem[], section: MenuItem['section']) =>
      items.filter(item => item.section === section).sort((a, b) => a.order - b.order),
    []
  );

  const normalizeMenuItems = useCallback(
    (items: MenuItem[]) => {
      const mainItems = getSectionItems(items, 'main').map((item, index) => ({
        ...item,
        section: 'main' as const,
        order: index,
      }));
      const otherItems = getSectionItems(items, 'other').map((item, index) => ({
        ...item,
        section: 'other' as const,
        order: index,
      }));

      return [...mainItems, ...otherItems];
    },
    [getSectionItems]
  );

  const persistMenuItems = useCallback(
    async (items: MenuItem[]) => {
      const mainItems = getSectionItems(items, 'main');
      const otherItems = getSectionItems(items, 'other');
      const payload: UserMenuPayload[] = [
        ...mainItems.map((item, index) => ({
          name: item.id,
          order: index,
          enabled: true,
        })),
        ...otherItems.map((item, index) => ({
          name: item.id,
          order: index,
          enabled: false,
        })),
      ];

      try {
        isUpdatingUserMenu.current = true;
        await updateUserMenu(payload).unwrap();
      } catch (err) {
        console.error('Failed to update user menu:', err);
      } finally {
        isUpdatingUserMenu.current = false;
      }
    },
    [getSectionItems, updateUserMenu]
  );

  const moveMenuItem = useCallback(
    (
      items: MenuItem[],
      sourceList: string,
      sourceIndex: number,
      targetList: string,
      targetIndex: number
    ) => {
      const sourceSection = sourceList as MenuItem['section'];
      const targetSection = targetList as MenuItem['section'];
      const sourceItems = getSectionItems(items, sourceSection);
      const targetItems =
        sourceSection === targetSection ? sourceItems : getSectionItems(items, targetSection);

      const draggedItem = sourceItems[sourceIndex];
      if (!draggedItem) return null;

      if (sourceSection === targetSection) {
        const reorderedItems = [...sourceItems];
        reorderedItems.splice(sourceIndex, 1);
        let insertAt = targetIndex;
        if (sourceIndex < targetIndex) insertAt -= 1;
        reorderedItems.splice(insertAt, 0, draggedItem);

        const nextItems = [
          ...items.filter(item => item.section !== sourceSection),
          ...reorderedItems.map((item, index) => ({
            ...item,
            section: sourceSection,
            order: index,
          })),
        ];
        return normalizeMenuItems(nextItems);
      }

      const nextSourceItems = [...sourceItems];
      const nextTargetItems = [...targetItems];
      nextSourceItems.splice(sourceIndex, 1);
      const clampedTargetIndex = Math.min(Math.max(0, targetIndex), nextTargetItems.length);
      nextTargetItems.splice(clampedTargetIndex, 0, {
        ...draggedItem,
        section: targetSection,
      });

      const untouchedItems = items.filter(
        item => item.section !== sourceSection && item.section !== targetSection
      );

      return normalizeMenuItems([
        ...untouchedItems,
        ...nextSourceItems.map((item, index) => ({
          ...item,
          section: sourceSection,
          order: index,
        })),
        ...nextTargetItems.map((item, index) => ({
          ...item,
          section: targetSection,
          order: index,
        })),
      ]);
    },
    [getSectionItems, normalizeMenuItems]
  );

  const menuItems = getSectionItems(customMenuItems, 'main');
  const otherItems = getSectionItems(customMenuItems, 'other');

  const applyMenuMove = useCallback(
    (
      sourceList: string,
      sourceIndex: number,
      targetList: string,
      targetIndex: number,
      items = customMenuItemsRef.current
    ) => {
      const nextItems = moveMenuItem(items, sourceList, sourceIndex, targetList, targetIndex);
      if (!nextItems) return null;

      setCustomMenuItems(nextItems);
      customMenuItemsRef.current = nextItems;
      return nextItems;
    },
    [moveMenuItem]
  );

  // Initialize from user menu API
  useEffect(() => {
    if (isUpdatingUserMenu.current) return;

    if (userMenuData?.data && userMenuData.data.length > 0) {
      const defaultItemMap = new Map(defaultMenuItems.map(item => [item.id, item]));
      const configuredNames = new Set<string>();
      const configuredItems = [...userMenuData.data]
        .sort((a, b) => a.order - b.order)
        .map(item => {
          const resolvedItemId = legacyMenuNameToId[item.name] ?? item.name;
          const defaultItem = defaultItemMap.get(resolvedItemId);
          if (!defaultItem) return null;
          configuredNames.add(defaultItem.id);
          return {
            ...defaultItem,
            section: item.enabled ? ('main' as const) : ('other' as const),
            order: item.order,
          };
        })
        .filter(Boolean) as MenuItem[];

      const missingItems = defaultMenuItems
        .filter(item => !configuredNames.has(item.id))
        .map(item => ({
          ...item,
          section: 'other' as const,
        }));

      setCustomMenuItems(normalizeMenuItems([...configuredItems, ...missingItems]));
    } else if (userMenuData && (!userMenuData.data || userMenuData.data.length === 0)) {
      setCustomMenuItems(normalizeMenuItems(defaultMenuItems));
    }
  }, [defaultMenuItems, normalizeMenuItems, userMenuData]);

  const handleMenuItemClick = (itemId: string) => {
    dispatch(closeAllModals());
    switch (itemId) {
      case 'dashboard':
        dispatch(openDashboardWindow());
        break;
      case 'objects':
        dispatch(openObjectManagerWindow());
        break;
      case 'tasks':
        dispatch(openTasksWindow());
        break;
      case 'notifications':
        dispatch(openNotificationWindow());
        break;
      case 'documents':
        dispatch(openDocumentsWindow());
        break;
      case 'calendar':
        dispatch(openCalendarWindow());
        break;
      case 'reconstruction':
        dispatch(openReconstructionWindow({ spaceId: activeSpaceId ?? 1 }));
        break;
      case 'spaces':
        dispatch(openSpacesWindow());
        break;
    }
  };

  const handleMouseLeave = () => {
    if (!isMoreElementsOpen) setIsWide(false);
  };

  const handleOtherElementsClick = () => {
    if (isMoreElementsOpen) {
      dispatch(closeMoreElementsWindow());
      setIsWide(false);
    } else {
      dispatch(closeAllModals());
      dispatch(openMoreElementsWindow());
      setIsWide(true);
    }
  };

  const handleCloseMoreElements = () => {
    dispatch(closeMoreElementsWindow());
    setIsWide(false);
  };

  useEffect(() => {
    if (!isMoreElementsOpen) setMoreSearch('');
  }, [isMoreElementsOpen]);

  const handleDragStart = useCallback(() => {
    dragSnapshotRef.current = customMenuItemsRef.current;
  }, []);

  const handleDragEnd = useCallback(
    async (didDrop: boolean, moved: boolean) => {
      if (!moved) {
        dragSnapshotRef.current = null;
        return;
      }

      if (!didDrop && dragSnapshotRef.current) {
        setCustomMenuItems(dragSnapshotRef.current);
        customMenuItemsRef.current = dragSnapshotRef.current;
        dragSnapshotRef.current = null;
        return;
      }

      dragSnapshotRef.current = null;
      await persistMenuItems(customMenuItemsRef.current);
    },
    [persistMenuItems]
  );

  const handleDrop = useCallback(
    async (sourceList: string, sourceIndex: number, targetList: string, targetIndex: number) => {
      const nextItems = applyMenuMove(
        sourceList,
        sourceIndex,
        targetList,
        targetIndex,
        customMenuItems
      );
      if (!nextItems) return;
      await persistMenuItems(nextItems);
    },
    [applyMenuMove, customMenuItems, persistMenuItems]
  );

  if (isLoadingUserMenu || isMatterportLoading) return null;

  return (
    <DndProvider backend={HTML5Backend}>
      <Box
        sx={{
          position: 'fixed',
          top: '50%',
          right: 40,
          transform: 'translateY(-50%)',
          zIndex: 9999,
        }}
      >
        <SidebarStack
          onMouseEnter={() => setIsWide(true)}
          onMouseLeave={handleMouseLeave}
        >
          {/* Main Sidebar */}
          <StyledPaper className={isWide ? 'expanded' : ''}>
            <StaticListItem
              sx={{
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.06)',
              }}
            >
              <StyledListItemIcon>
                <SearchRoundedIcon sx={{ fontSize: 20, color: 'white', opacity: 0.9 }} />
              </StyledListItemIcon>
              {isWide && <StyledListItemText primary="Search" />}
            </StaticListItem>
            <Box
              sx={{
                height: 2,
                bgcolor: '#FFFFFF',
                opacity: 0.5,
                borderRadius: '100px',
                mx: 1,
                my: 0,
              }}
            />

            {/* Draggable menu items */}
            <DroppableList
              items={menuItems}
              listType="main"
              onItemClick={handleMenuItemClick}
              isOpen={isOpen}
              isObjectsOpen={isObjectsOpen}
              isWide={isWide}
              onDrop={handleDrop}
              onHoverMove={applyMenuMove}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            />

            <DroppableMoreButton
              onClick={handleOtherElementsClick}
              isWide={isWide}
              onDropToOther={(sourceList, sourceIndex) => {
                void handleDrop(sourceList, sourceIndex, 'other', otherItems.length);
              }}
              onOpenMore={() => {
                dispatch(closeAllModals());
                dispatch(openMoreElementsWindow());
              }}
              setIsWide={setIsWide}
            />
          </StyledPaper>

          <ShortcutPaper className={isWide ? 'expanded' : ''}>
            <StaticListItem>
              <StyledListItemIcon>
                <ChatBubbleOutlineRoundedIcon
                  sx={{ fontSize: 20, color: 'white', opacity: 0.9 }}
                />
              </StyledListItemIcon>
              {isWide && <StyledListItemText primary="Chat" />}
            </StaticListItem>
          </ShortcutPaper>
        </SidebarStack>

      </Box>

      {/* More Elements Dialog */}
      <Dialog
        open={isMoreElementsOpen}
        onClose={handleCloseMoreElements}
        className="w-[560px]"
        PaperProps={{
          sx: {
            borderRadius: '32px',
            overflow: 'hidden',
            backgroundColor: 'rgba(46, 46, 46, 0.35)',
            backdropFilter: 'blur(100px)',
            WebkitBackdropFilter: 'blur(100px)',
            padding: '32px 24px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            height: 'auto',
            maxHeight: '90vh',
          },
        }}
      >
        <Box
          sx={{
            padding: '0 8px 0 8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <TextField
            value={moreSearch}
            onChange={e => setMoreSearch(e.target.value)}
            placeholder="Search apps"
            variant="standard"
            fullWidth
            autoFocus
            InputProps={{
              disableUnderline: true,
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon sx={{ fontSize: 20, color: 'white', opacity: 0.9 }} />
                </InputAdornment>
              ),
              sx: {
                color: 'white',
                fontSize: '16px',
                lineHeight: '20px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                borderRadius: '500px',
                padding: '8px 16px',
                '& input': { padding: 0 },
                '& input::placeholder': { color: 'rgba(255, 255, 255, 0.6)', opacity: 1 },
              },
            }}
          />
          <IconButton
            onClick={handleCloseMoreElements}
            sx={{ color: 'white', opacity: 0.75, '&:hover': { opacity: 1 }, flexShrink: 0 }}
          >
            <Icon src="/icons/mattertag/cross.svg" alt="Close" />
          </IconButton>
        </Box>

        <DroppableList
          items={otherItems.filter(item =>
            item.label.toLowerCase().includes(moreSearch.trim().toLowerCase())
          )}
          listType="other"
          onItemClick={handleMenuItemClick}
          isOpen={isOpen}
          isObjectsOpen={isObjectsOpen}
          isWide={true}
          onDrop={handleDrop}
          onHoverMove={applyMenuMove}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          layout="grid"
        />
      </Dialog>
    </DndProvider>
  );
}
// Build: Sun Mar 22 16:38:21 CET 2026
