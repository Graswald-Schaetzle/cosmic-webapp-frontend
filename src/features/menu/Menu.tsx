import { useEffect, useRef, useState, useCallback } from 'react';
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
  closeAllModals,
} from '../../store/modalSlice.ts';
import { RootState } from '../../store/store';
import { useMatterport } from '../../contexts/MatterportContext';
import {
  Box,
  Paper,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Typography,
  styled,
} from '@mui/material';
import {
  useGetUserMenuQuery,
  useUpdateUserMenuMutation,
  UserMenuPayload,
} from '../../api/userMenu/userMenuApi';

interface MenuItem {
  id: string;
  icon: string;
  label: string;
  enabled: boolean;
  order: number;
  name: string;
}

const DND_TYPE = 'MENU_ITEM';

const MAX_MAIN_ITEMS = 8;

const defaultMenuItems: MenuItem[] = [
  { id: 'dashboard', icon: '/icons/menu/white/dashboard.svg', label: 'Dashboard', enabled: true, order: 0, name: 'Dashboard' },
  { id: 'objects', icon: '/icons/menu/white/objects.svg', label: 'Objects', enabled: true, order: 1, name: 'Objects' },
  { id: 'tasks', icon: '/icons/menu/white/tasks.svg', label: 'Tasks', enabled: true, order: 2, name: 'Tasks' },
  { id: 'notifications', icon: '/icons/menu/white/notifications.svg', label: 'Notifications', enabled: true, order: 3, name: 'Notifications' },
  { id: 'calendar', icon: '/icons/menu/white/calendar.svg', label: 'Calendar', enabled: true, order: 4, name: 'Calendar' },
  { id: 'ai-agent', icon: '/icons/menu/white/ai-agent.svg', label: 'AI Agent', enabled: true, order: 5, name: 'AI Agent' },
  { id: 'documents', icon: '/icons/menu/white/documents.svg', label: 'Documents', enabled: true, order: 6, name: 'Documents' },
  { id: 'profile', icon: '/icons/menu/white/profile.svg', label: 'Profile', enabled: true, order: 7, name: 'Profile' },
];

const defaultOtherItems: MenuItem[] = [
  { id: 'interior-designer', icon: '/icons/menu/white/tasks.svg', label: 'Interior Designer', enabled: true, order: 0, name: 'Interior Designer' },
  { id: 'food-delivery', icon: '/icons/menu/white/tasks.svg', label: 'Food Delivery', enabled: true, order: 1, name: 'Food Delivery' },
  { id: 'insurance', icon: '/icons/menu/white/tasks.svg', label: 'Insurance', enabled: true, order: 2, name: 'Insurance' },
  { id: 'games', icon: '/icons/menu/white/tasks.svg', label: 'Games', enabled: true, order: 3, name: 'Games' },
  { id: 'reconstruction', icon: '/icons/menu/white/3d-reconstruction.svg', label: '3D-Rekonstruktion', enabled: true, order: 4, name: '3D-Rekonstruktion' },
];

// --- Styled Components ---

const StyledPaper = styled(Paper)({
  position: 'fixed',
  top: '50%',
  right: 40,
  transform: 'translateY(-50%)',
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
    '& img': {
      filter: 'brightness(0)',
    },
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

const OtherElementsPaper = styled(Paper)(({ theme }) => ({
  width: '100%',
  borderRadius: 32,
  padding: theme.spacing(1.5),
  background: 'var(--Back, #2E2E2E59)',
  backdropFilter: 'blur(100px)',
  WebkitBackdropFilter: 'blur(100px)',
  transition: 'all 0.3s ease',
  boxShadow: 'none',
  '&.hidden': {
    opacity: 0,
    pointerEvents: 'none',
    transform: 'scaleX(0)',
  },
  '& .MuiListItemText-primary': {
    transform: 'scaleX(1) !important',
    opacity: '1 !important',
    color: 'white',
    whiteSpace: 'nowrap',
  },
  '& .MuiListItem': {
    minWidth: 'fit-content',
  },
}));

const TooltipBox = styled(Box)({
  width: '100%',
  borderRadius: '16px',
  padding: '8px 16px 8px 12px',
  background: 'var(--Back, #2E2E2E59)',
  backdropFilter: 'blur(100px)',
  WebkitBackdropFilter: 'blur(100px)',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  transition: 'all 0.3s ease',
  boxShadow: 'none',
  '&.hidden': {
    opacity: 0,
    pointerEvents: 'none',
    transform: 'scaleX(0)',
  },
});

const TooltipTitle = styled(Typography)({
  fontWeight: 510,
  fontSize: '10px',
  lineHeight: '14px',
  color: 'white',
});

const TooltipDescription = styled(Typography)({
  fontWeight: 510,
  fontSize: '12px',
  lineHeight: '14px',
  color: 'white',
  whiteSpace: 'normal',
  wordWrap: 'break-word',
});

const Icon = styled('img')({
  width: 24,
  height: 24,
});

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
}

// --- DropZone Component (between items) ---

interface DropZoneProps {
  targetList: string;
  targetIndex: number;
  onDrop: (sourceList: string, sourceIndex: number, targetList: string, targetIndex: number) => void;
  isMainList: boolean;
  currentMainCount: number;
}

function DropZone({ targetList, targetIndex, onDrop, isMainList, currentMainCount }: DropZoneProps) {
  const [{ isOver, canDrop, draggedItem }, drop] = useDrop({
    accept: DND_TYPE,
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop(),
      draggedItem: monitor.getItem() as DragItem | null,
    }),
    drop: (item: DragItem) => {
      if (item.sourceList === targetList && item.index === targetIndex) return;
      if (item.sourceList === targetList && item.index === targetIndex - 1) return;
      onDrop(item.sourceList, item.index, targetList, targetIndex);
    },
  });

  const isRestricted = draggedItem?.id === 'tasks' || draggedItem?.id === 'dashboard';
  const isCrossList = draggedItem && draggedItem.sourceList !== targetList;
  const wouldExceedMax = isMainList && isCrossList && currentMainCount >= MAX_MAIN_ITEMS;
  const blocked = (isCrossList && isRestricted && targetList === 'other') || wouldExceedMax;

  return (
    <div
      ref={drop}
      style={{
        height: isOver && canDrop && !blocked ? '12px' : '2px',
        borderRadius: '4px',
        backgroundColor: isOver && canDrop && !blocked
          ? 'rgba(255, 255, 255, 0.5)'
          : 'transparent',
        transition: 'all 0.15s ease',
        flexShrink: 0,
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
}

function DraggableMenuItem({
  item,
  index,
  listType,
  onItemClick,
  isOpen,
  isObjectsOpen,
  isWide,
}: DraggableMenuItemProps) {
  const [{ isDragging }, drag] = useDrag({
    type: DND_TYPE,
    item: { id: item.id, index, sourceList: listType },
    collect: (monitor: DragSourceMonitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const isSelected =
    (item.id === 'dashboard' && isOpen) || (item.id === 'objects' && isObjectsOpen);

  return (
    <div
      ref={drag}
      style={{
        opacity: isDragging ? 0.3 : 1,
        cursor: 'grab',
      }}
    >
      <StyledListItem
        onClick={() => onItemClick(item.id)}
        className={isSelected ? 'selected' : ''}
      >
        <StyledListItemIcon>
          <Icon src={item.icon} alt={item.label} />
        </StyledListItemIcon>
        {isWide && <StyledListItemText primary={item.label} />}
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
  onDrop: (sourceList: string, sourceIndex: number, targetList: string, targetIndex: number) => void;
  isMainList: boolean;
  currentMainCount: number;
}

function DroppableList({
  items,
  listType,
  onItemClick,
  isOpen,
  isObjectsOpen,
  isWide,
  onDrop,
  isMainList,
  currentMainCount,
}: DroppableListProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      {items.map((item, index) => (
        <Box key={item.id}>
          <DropZone
            targetList={listType}
            targetIndex={index}
            onDrop={onDrop}
            isMainList={isMainList}
            currentMainCount={currentMainCount}
          />
          <DraggableMenuItem
            item={item}
            index={index}
            listType={listType}
            onItemClick={onItemClick}
            isOpen={isOpen}
            isObjectsOpen={isObjectsOpen}
            isWide={isWide}
          />
        </Box>
      ))}
      <DropZone
        targetList={listType}
        targetIndex={items.length}
        onDrop={onDrop}
        isMainList={isMainList}
        currentMainCount={currentMainCount}
      />
    </Box>
  );
}

// --- Main Menu Component ---

export function Menu() {
  const dispatch = useDispatch();
  const { isOpen } = useSelector((state: RootState) => state.modal.dashboardWindowModal);
  const { isOpen: isObjectsOpen } = useSelector(
    (state: RootState) => state.modal.objectManagerWindowModal
  );
  const { isLoading: isMatterportLoading } = useMatterport();

  const { data: userMenuData, isLoading: isLoadingUserMenu } = useGetUserMenuQuery();
  const [updateUserMenu] = useUpdateUserMenuMutation();

  const [menuItems, setMenuItems] = useState<MenuItem[]>(defaultMenuItems);
  const [otherItems, setOtherItems] = useState<MenuItem[]>(defaultOtherItems);
  const [isWide, setIsWide] = useState(false);
  const [showOtherElements, setShowOtherElements] = useState(false);
  const isUpdatingUserMenu = useRef(false);

  // Initialize from user menu API
  useEffect(() => {
    if (isUpdatingUserMenu.current) return;

    if (userMenuData?.data && userMenuData.data.length > 0) {
      const userMenuItems = userMenuData.data
        .filter((item) => item.enabled)
        .sort((a, b) => a.order - b.order)
        .map((item) => {
          const defaultItem = [...defaultMenuItems, ...defaultOtherItems].find((di) => di.name === item.name);
          return defaultItem ? { ...defaultItem, order: item.order } : null;
        })
        .filter(Boolean) as MenuItem[];

      const userMenuNames = userMenuData.data.map((item) => item.name);
      const otherMenuItems = [...defaultMenuItems, ...defaultOtherItems]
        .filter((item) => !userMenuNames.includes(item.name))
        .map((item) => ({ ...item, enabled: true }));

      setMenuItems(userMenuItems);
      setOtherItems(otherMenuItems);
    } else if (userMenuData && (!userMenuData.data || userMenuData.data.length === 0)) {
      setMenuItems(defaultMenuItems);
      setOtherItems(defaultOtherItems);
    }
  }, [userMenuData]);

  const handleMenuItemClick = (itemId: string) => {
    dispatch(closeAllModals());
    switch (itemId) {
      case 'dashboard': dispatch(openDashboardWindow()); break;
      case 'objects': dispatch(openObjectManagerWindow()); break;
      case 'tasks': dispatch(openTasksWindow()); break;
      case 'notifications': dispatch(openNotificationWindow()); break;
      case 'documents': dispatch(openDocumentsWindow()); break;
      case 'calendar': dispatch(openCalendarWindow()); break;
      case 'reconstruction': dispatch(openReconstructionWindow({ spaceId: 1 })); break;
    }
  };

  const handleMouseLeave = () => {
    if (!showOtherElements) setIsWide(false);
  };

  const handleOtherElementsClick = () => {
    setShowOtherElements(!showOtherElements);
    setIsWide(true);
  };

  const handleDrop = useCallback(
    async (sourceList: string, sourceIndex: number, targetList: string, targetIndex: number) => {
      const source = sourceList === 'main' ? [...menuItems] : [...otherItems];
      const target = targetList === 'main' ? [...menuItems] : [...otherItems];

      const draggedItem = source[sourceIndex];
      if (!draggedItem) return;

      // Prevent moving tasks/dashboard from main to other
      if (sourceList === 'main' && targetList === 'other') {
        if (draggedItem.id === 'tasks' || draggedItem.id === 'dashboard') return;
      }

      // Prevent exceeding max in main menu when moving from other
      if (sourceList !== 'main' && targetList === 'main' && menuItems.length >= MAX_MAIN_ITEMS) {
        return;
      }

      if (sourceList === targetList) {
        // Reorder within the same list
        source.splice(sourceIndex, 1);
        let insertAt = targetIndex;
        if (sourceIndex < targetIndex) insertAt -= 1;
        source.splice(insertAt, 0, draggedItem);

        if (sourceList === 'main') {
          setMenuItems(source);
        } else {
          setOtherItems(source);
        }
      } else {
        // Move between lists
        source.splice(sourceIndex, 1);
        target.splice(targetIndex, 0, draggedItem);

        if (sourceList === 'main') {
          setMenuItems(source);
          setOtherItems(target);
        } else {
          setMenuItems(target);
          setOtherItems(source);
        }
      }

      // Persist to API (main menu items only)
      const newMain = sourceList === 'main'
        ? (targetList === 'main' ? source : target)
        : (targetList === 'main' ? target : source);

      if (sourceList === 'main' || targetList === 'main') {
        const payload: UserMenuPayload[] = newMain.map((item, idx) => ({
          name: item.name,
          order: idx,
          enabled: true,
        }));
        try {
          isUpdatingUserMenu.current = true;
          await updateUserMenu(payload).unwrap();
        } catch (err) {
          console.error('Failed to update user menu:', err);
        } finally {
          isUpdatingUserMenu.current = false;
        }
      }
    },
    [menuItems, otherItems, updateUserMenu]
  );

  if (isLoadingUserMenu || isMatterportLoading) return null;

  return (
    <DndProvider backend={HTML5Backend}>
      <Box
        sx={{
          position: 'fixed',
          top: '50%',
          right: 0,
          transform: 'translateY(-50%)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: '30px',
        }}
      >
        {/* Main Sidebar */}
        <StyledPaper
          className={isWide ? 'expanded' : ''}
          onMouseEnter={() => setIsWide(true)}
          onMouseLeave={handleMouseLeave}
        >
          {/* AI Agent - fixed at top */}
          <StyledListItem>
            <StyledListItemIcon>
              <Icon src="/icons/menu/white/ai-agent.svg" alt="AI Agent" />
            </StyledListItemIcon>
            {isWide && <StyledListItemText primary="AI Agent" />}
          </StyledListItem>
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
            isMainList={true}
            currentMainCount={menuItems.length}
          />

          {/* More button */}
          <StyledListItem onClick={handleOtherElementsClick} sx={{ justifyContent: 'flex-start' }}>
            <StyledListItemIcon>
              <Icon src="/icons/menu/plus.svg" alt="More" />
            </StyledListItemIcon>
            {isWide && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <StyledListItemText primary="More" />
                {menuItems.length >= MAX_MAIN_ITEMS && (
                  <Box
                    sx={{
                      backgroundColor: 'rgba(255, 255, 255, 0.15)',
                      color: 'rgba(255, 255, 255, 0.8)',
                      fontSize: '10px',
                      padding: '2px 6px',
                      borderRadius: '8px',
                      fontWeight: 'bold',
                    }}
                  >
                    MAX
                  </Box>
                )}
              </Box>
            )}
          </StyledListItem>
        </StyledPaper>

        {/* More Panel */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            position: 'fixed',
            top: '50%',
            right: '248px',
            width: '186px',
            transform: 'translateY(-50%)',
            zIndex: 10000,
          }}
        >
          <TooltipBox data-tooltip="true" className={showOtherElements ? '' : 'hidden'}>
            <TooltipTitle>Tooltip:</TooltipTitle>
            <TooltipDescription>Drag &amp; Drop elements with your mouse</TooltipDescription>
          </TooltipBox>

          <OtherElementsPaper className={showOtherElements ? '' : 'hidden'}>
            <Box sx={{ position: 'relative', width: '100%' }}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  pl: 1,
                  minWidth: 'fit-content',
                }}
              >
                <Typography
                  variant="subtitle2"
                  sx={{
                    color: 'white',
                    height: 44,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    whiteSpace: 'nowrap',
                  }}
                >
                  More elements
                </Typography>
                <IconButton
                  onClick={() => {
                    setShowOtherElements(false);
                    setIsWide(false);
                  }}
                  sx={{ color: 'white', opacity: 0.75, '&:hover': { opacity: 1 } }}
                >
                  <Icon src="/icons/mattertag/cross.svg" alt="Close" />
                </IconButton>
              </Box>

              <DroppableList
                items={otherItems}
                listType="other"
                onItemClick={handleMenuItemClick}
                isOpen={isOpen}
                isObjectsOpen={isObjectsOpen}
                isWide={true}
                onDrop={handleDrop}
                isMainList={false}
                currentMainCount={menuItems.length}
              />
            </Box>
          </OtherElementsPaper>
        </Box>
      </Box>
    </DndProvider>
  );
}
// Build: Sun Mar 22 16:38:21 CET 2026
