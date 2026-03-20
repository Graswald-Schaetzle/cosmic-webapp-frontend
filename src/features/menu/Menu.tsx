import { useEffect, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { DndProvider, useDrag, useDrop, DragSourceMonitor, DropTargetMonitor } from 'react-dnd';
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
  useCreateUserMenuMutation,
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

const defaultMenuItems: MenuItem[] = [
  {
    id: 'dashboard',
    icon: '/icons/menu/white/dashboard.svg',
    label: 'Dashboard',
    enabled: true,
    order: 0,
    name: 'Dashboard',
  },
  {
    id: 'objects',
    icon: '/icons/menu/white/objects.svg',
    label: 'Objects',
    enabled: true,
    order: 1,
    name: 'Objects',
  },
  {
    id: 'tasks',
    icon: '/icons/menu/white/tasks.svg',
    label: 'Tasks',
    enabled: true,
    order: 2,
    name: 'Tasks',
  },
  {
    id: 'notifications',
    icon: '/icons/menu/white/notifications.svg',
    label: 'Notifications',
    enabled: true,
    order: 3,
    name: 'Notifications',
  },
  {
    id: 'calendar',
    icon: '/icons/menu/white/calendar.svg',
    label: 'Calendar',
    enabled: true,
    order: 4,
    name: 'Calendar',
  },
  {
    id: 'ai-agent',
    icon: '/icons/menu/white/ai-agent.svg',
    label: 'AI Agent',
    enabled: true,
    order: 5,
    name: 'AI Agent',
  },
  {
    id: 'documents',
    icon: '/icons/menu/white/documents.svg',
    label: 'Documents',
    enabled: true,
    order: 6,
    name: 'Documents',
  },
  {
    id: 'profile',
    icon: '/icons/menu/white/profile.svg',
    label: 'Profile',
    enabled: true,
    order: 7,
    name: 'Profile',
  },
  {
    id: 'interior-designer',
    icon: '/icons/menu/white/tasks.svg',
    label: 'Interior Designer',
    enabled: true,
    order: 8,
    name: 'Interior Designer',
  },
  {
    id: 'food-delivery',
    icon: '/icons/menu/white/tasks.svg',
    label: 'Food Delivery',
    enabled: true,
    order: 9,
    name: 'Food Delivery',
  },
  {
    id: 'insurance',
    icon: '/icons/menu/white/tasks.svg',
    label: 'Insurance',
    enabled: true,
    order: 10,
    name: 'Insurance',
  },
  {
    id: 'games',
    icon: '/icons/menu/white/tasks.svg',
    label: 'Games',
    enabled: true,
    order: 11,
    name: 'Games',
  },
  {
    id: 'reconstruction',
    icon: '/icons/menu/white/3d-reconstruction.svg',
    label: '3D-Rekonstruktion',
    enabled: true,
    order: 12,
    name: '3D-Rekonstruktion',
  },
];

const defaultOtherItems: MenuItem[] = [];

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
  '&.sortable-ghost': {
    opacity: 0.5,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  '&.sortable-chosen': {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    boxShadow: '0 0 10px rgba(255, 255, 255, 0.1)',
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

// Add CSS keyframes for animations
const globalStyles = `
  @keyframes pulse {
    0% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.5;
      transform: scale(1.1);
    }
    100% {
      opacity: 1;
      transform: scale(1);
    }
  }
`;

// Inject global styles
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = globalStyles;
  document.head.appendChild(styleElement);
}

interface DragItem {
  id: string;
  index: number;
  type: string;
}

interface DraggableMenuItemProps {
  item: MenuItem;
  index: number;
  moveItem: (dragIndex: number, hoverIndex: number, sourceList: string, targetList: string) => void;
  listType: string;
  onItemClick: (id: string) => void;
  isOpen: boolean;
  isObjectsOpen: boolean;
  isWide: boolean;
}

const DraggableMenuItem = ({
  item,
  index,
  moveItem,
  listType,
  onItemClick,
  isOpen,
  isObjectsOpen,
  isWide,
}: DraggableMenuItemProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [{ isDragging }, drag] = useDrag({
    type: 'MENU_ITEM',
    item: { id: item.id, index, type: listType },
    collect: (monitor: DragSourceMonitor) => ({
      isDragging: monitor.isDragging(),
    }),
    canDrag: () => {
      // Allow dragging for all items, but we'll handle restrictions in the drop logic
      return true;
    },
  });

  const [{ isOver, canDrop, draggedItem }, drop] = useDrop({
    accept: 'MENU_ITEM',
    collect: (monitor: DropTargetMonitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
      draggedItem: monitor.getItem() as DragItem | null,
    }),
    drop: (draggedItem: DragItem) => {
      const dragIndex = draggedItem.index;
      const hoverIndex = index;
      const sourceList = draggedItem.type;
      const targetList = listType;

      // Only move if the item is actually being dropped in a different position or list
      if (dragIndex !== hoverIndex || sourceList !== targetList) {
        moveItem(dragIndex, hoverIndex, sourceList, targetList);
      }
    },
  });

  // Check if the dragged item is restricted (tasks or dashboard from main menu)
  const isDraggingRestrictedItem =
    draggedItem &&
    (draggedItem.id === 'tasks' || draggedItem.id === 'dashboard') &&
    draggedItem.type === 'main' &&
    listType === 'other';

  drag(drop(ref));

  const isSelected =
    (item.id === 'dashboard' && isOpen) || (item.id === 'objects' && isObjectsOpen);

  return (
    <div
      ref={ref}
      style={{
        opacity: isDragging ? 0.5 : 1,
        position: 'relative',
      }}
    >
      {/* Drop preview indicator */}
      {isOver && canDrop && !isDraggingRestrictedItem && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '2px',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            zIndex: 10,
            animation: 'pulse 1s infinite',
          }}
        />
      )}
      {/* Restricted item drop indicator */}
      {isOver && isDraggingRestrictedItem && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '2px',
            backgroundColor: 'rgba(255, 0, 0, 0.8)',
            zIndex: 10,
            animation: 'pulse 1s infinite',
          }}
        />
      )}
      <StyledListItem
        onClick={() => onItemClick(item.id)}
        className={isSelected ? 'selected' : ''}
        sx={{
          backgroundColor:
            isOver && canDrop && !isDraggingRestrictedItem
              ? 'rgba(255, 255, 255, 0.15)'
              : 'transparent',
          border:
            isOver && canDrop && !isDraggingRestrictedItem
              ? '2px dashed rgba(255, 255, 255, 0.6)'
              : '2px solid transparent',
          transition: 'all 0.2s ease',
        }}
      >
        <StyledListItemIcon>
          <Icon src={item.icon} alt={item.label} />
        </StyledListItemIcon>
        {isWide && <StyledListItemText primary={item.label} />}
      </StyledListItem>
    </div>
  );
};

// Empty drop zone component for when main menu is empty
const EmptyDropZone = ({
  moveItem,
  listType,
  isWide,
  isAtMaxCapacity,
}: {
  moveItem: (dragIndex: number, hoverIndex: number, sourceList: string, targetList: string) => void;
  listType: string;
  isWide: boolean;
  isAtMaxCapacity: boolean;
}) => {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isOver, canDrop, draggedItem }, drop] = useDrop({
    accept: 'MENU_ITEM',
    collect: (monitor: DropTargetMonitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop() && !isAtMaxCapacity,
      draggedItem: monitor.getItem() as DragItem | null,
    }),
    drop: (draggedItem: DragItem) => {
      // Don't allow drops if at max capacity
      if (isAtMaxCapacity) {
        return;
      }
      // When dropping on empty zone, add to the end of the list
      moveItem(draggedItem.index, 0, draggedItem.type, listType);
    },
  });

  // Check if the dragged item is restricted (tasks or dashboard from main menu)
  const isDraggingRestrictedItem =
    draggedItem &&
    (draggedItem.id === 'tasks' || draggedItem.id === 'dashboard') &&
    draggedItem.type === 'main' &&
    listType === 'other';

  drop(ref);

  const getVisualStyle = () => {
    if (isDraggingRestrictedItem) {
      return {
        border: '2px dashed rgba(255, 0, 0, 0.6)',
        backgroundColor: 'rgba(255, 0, 0, 0.1)',
        color: 'rgba(255, 0, 0, 0.8)',
        transform: 'scale(1.02)',
        backdropFilter: 'blur(100px)',
        WebkitBackdropFilter: 'blur(100px)',
      };
    }
    if (isAtMaxCapacity) {
      return {
        border: '2px dashed rgba(255, 255, 255, 0.3)',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        color: 'rgba(255, 255, 255, 0.4)',
        backdropFilter: 'blur(100px)',
        WebkitBackdropFilter: 'blur(100px)',
      };
    }
    if (isOver && canDrop) {
      return {
        border: '2px dashed rgba(255, 255, 255, 0.8)',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        color: 'rgba(255, 255, 255, 0.9)',
        transform: 'scale(1.02)',
        backdropFilter: 'blur(100px)',
        WebkitBackdropFilter: 'blur(100px)',
      };
    }
    return {
      border: '2px dashed rgba(255, 255, 255, 0.3)',
      backgroundColor: 'transparent',
      color: 'rgba(255, 255, 255, 0.5)',
    };
  };

  const visualStyle = getVisualStyle();

  return (
    <div
      ref={ref}
      style={{
        minHeight: '40px',
        borderRadius: '20px',
        margin: '6px 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s ease',
        ...visualStyle,
      }}
    >
      {isWide && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography
            sx={{
              fontSize: '12px',
              textAlign: 'center',
              color: visualStyle.color,
            }}
          >
            {isDraggingRestrictedItem
              ? 'Cannot move this item!'
              : isAtMaxCapacity
                ? 'Max items reached'
                : isOver && canDrop
                  ? 'Drop here!'
                  : 'Drop here'}
          </Typography>
          {isOver && canDrop && !isAtMaxCapacity && !isDraggingRestrictedItem && (
            <Box
              sx={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                animation: 'pulse 1s infinite',
              }}
            />
          )}
          {isDraggingRestrictedItem && (
            <Box
              sx={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 0, 0, 0.8)',
                animation: 'pulse 1s infinite',
              }}
            />
          )}
        </Box>
      )}
    </div>
  );
};

export function Menu() {
  const dispatch = useDispatch();
  const { isOpen } = useSelector((state: RootState) => state.modal.dashboardWindowModal);
  const { isOpen: isObjectsOpen } = useSelector(
    (state: RootState) => state.modal.objectManagerWindowModal
  );
  const { isLoading: isMatterportLoading } = useMatterport();

  // User menu API hooks
  const { data: userMenuData, isLoading: isLoadingUserMenu } = useGetUserMenuQuery();
  const [createUserMenu] = useCreateUserMenuMutation();
  const [updateUserMenu] = useUpdateUserMenuMutation();

  const [menuItems, setMenuItems] = useState<MenuItem[]>(defaultMenuItems);
  const [otherItems, setOtherItems] = useState<MenuItem[]>(defaultOtherItems);
  const [isWide, setIsWide] = useState(false);
  const [showOtherElements, setShowOtherElements] = useState(false);
  const otherElementsRef = useRef<HTMLDivElement>(null);
  const isUpdatingUserMenu = useRef(false);

  // Initialize menu items from user menu data
  useEffect(() => {
    // Skip if we're currently updating the user menu
    if (isUpdatingUserMenu.current) {
      return;
    }

    if (userMenuData && userMenuData.data && userMenuData.data.length > 0) {
      // Convert user menu data to menu items
      const userMenuItems = userMenuData.data
        .filter(item => item.enabled)
        .sort((a, b) => a.order - b.order)
        .map(item => {
          const defaultItem = defaultMenuItems.find(di => di.name === item.name);
          return defaultItem ? { ...defaultItem, order: item.order } : null;
        })
        .filter(Boolean) as MenuItem[];

      // Get items not in user menu for other items
      const userMenuNames = userMenuData.data.map(item => item.name);
      const otherMenuItems = defaultMenuItems
        .filter(item => !userMenuNames.includes(item.name))
        .map(item => ({ ...item, enabled: true }));

      setMenuItems(userMenuItems);
      setOtherItems(otherMenuItems);
    } else if (userMenuData && (!userMenuData.data || userMenuData.data.length === 0)) {
      // API returned empty data - main menu is empty, all items go to other menu
      setMenuItems([]);
      setOtherItems(defaultMenuItems.map(item => ({ ...item, enabled: true })));
    }
  }, [userMenuData, createUserMenu]);

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
        dispatch(openReconstructionWindow({ spaceId: 1 }));
        break;
      default:
        break;
    }
  };

  const handleMouseLeave = () => {
    if (!showOtherElements) {
      setIsWide(false);
    }
  };

  const handleOtherElementsClick = () => {
    setShowOtherElements(!showOtherElements);
    setIsWide(true);
  };

  const moveItem = async (
    dragIndex: number,
    hoverIndex: number,
    sourceList: string,
    targetList: string
  ) => {
    const sourceItems = sourceList === 'main' ? menuItems : otherItems;
    const targetItems = targetList === 'main' ? menuItems : otherItems;

    // Prevent moving tasks and dashboard from main menu to other menu
    if (sourceList === 'main' && targetList === 'other') {
      const draggedItem = sourceItems[dragIndex];
      if (draggedItem.id === 'tasks' || draggedItem.id === 'dashboard') {
        console.warn('Tasks and Dashboard must always remain in the main menu.');
        return;
      }
    }

    // Check if trying to add to main menu and it's already at max capacity (10 items)
    // Only apply this check when moving FROM other TO main menu
    if (targetList === 'main' && sourceList !== 'main' && targetItems.length >= 10) {
      console.warn('Main menu is at maximum capacity (10 items). Cannot add more items.');
      return;
    }

    const draggedItem = sourceItems[dragIndex];
    const newSourceItems = [...sourceItems];
    const newTargetItems = [...targetItems];

    let updatedMenuItems = menuItems;

    if (sourceList === targetList) {
      // Moving within the same list
      newSourceItems.splice(dragIndex, 1);
      newSourceItems.splice(hoverIndex, 0, draggedItem);

      if (sourceList === 'main') {
        setMenuItems(newSourceItems);
        updatedMenuItems = newSourceItems;
      } else {
        setOtherItems(newSourceItems);
      }
    } else {
      // Moving between lists
      newSourceItems.splice(dragIndex, 1);
      newTargetItems.splice(hoverIndex, 0, draggedItem);

      if (sourceList === 'main') {
        // Moving from main to other
        setMenuItems(newSourceItems);
        setOtherItems(newTargetItems);
        updatedMenuItems = newSourceItems;
      } else {
        // Moving from other to main
        setMenuItems(newTargetItems);
        setOtherItems(newSourceItems);
        updatedMenuItems = newTargetItems;
      }
    }

    // Update user menu after drag and drop (only for main menu items)
    if (sourceList === 'main' || targetList === 'main') {
      const updatedUserMenu: UserMenuPayload[] = updatedMenuItems.map((item, index) => ({
        name: item.name,
        order: index,
        enabled: true,
      }));

      try {
        isUpdatingUserMenu.current = true;
        await updateUserMenu(updatedUserMenu).unwrap();
      } catch (error) {
        console.error('Failed to update user menu:', error);
      } finally {
        isUpdatingUserMenu.current = false;
      }
    }
  };

  // Hide menu completely while fetching user menu or while Matterport is loading
  if (isLoadingUserMenu || isMatterportLoading) {
    return null;
  }

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
        <StyledPaper
          className={isWide ? 'expanded' : ''}
          onMouseEnter={() => setIsWide(true)}
          onMouseLeave={handleMouseLeave}
        >
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
          <Box sx={{ p: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {menuItems.length > 0 ? (
              menuItems.map((item, index) => (
                <DraggableMenuItem
                  key={item.id}
                  item={item}
                  index={index}
                  moveItem={moveItem}
                  listType="main"
                  onItemClick={handleMenuItemClick}
                  isOpen={isOpen}
                  isObjectsOpen={isObjectsOpen}
                  isWide={isWide}
                />
              ))
            ) : (
              <EmptyDropZone
                moveItem={moveItem}
                listType="main"
                isWide={isWide}
                isAtMaxCapacity={menuItems.length >= 10}
              />
            )}
          </Box>
          <StyledListItem onClick={handleOtherElementsClick} sx={{ justifyContent: 'flex-start' }}>
            <StyledListItemIcon>
              <Icon src="/icons/menu/plus.svg" alt="More" />
            </StyledListItemIcon>
            {isWide && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <StyledListItemText primary={'More'} />
                {menuItems.length >= 10 && (
                  <Box
                    sx={{
                      backgroundColor: 'rgba(255, 255, 255, 0.15)',
                      color: 'rgba(255, 255, 255, 0.8)',
                      fontSize: '10px',
                      padding: '2px 6px',
                      borderRadius: '8px',
                      fontWeight: 'bold',
                      backdropFilter: 'blur(100px)',
                      WebkitBackdropFilter: 'blur(100px)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                    }}
                  >
                    MAX
                  </Box>
                )}
              </Box>
            )}
          </StyledListItem>
        </StyledPaper>

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
            <TooltipDescription>Drag & Drop elements with your mouse</TooltipDescription>
          </TooltipBox>

          <OtherElementsPaper ref={otherElementsRef} className={showOtherElements ? '' : 'hidden'}>
            <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
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
              <Box sx={{ p: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {otherItems.length > 0 ? (
                  otherItems.map((item, index) => (
                    <DraggableMenuItem
                      key={item.id}
                      item={item}
                      index={index}
                      moveItem={moveItem}
                      listType="other"
                      onItemClick={handleMenuItemClick}
                      isOpen={isOpen}
                      isObjectsOpen={isObjectsOpen}
                      isWide={isWide}
                    />
                  ))
                ) : (
                  <EmptyDropZone
                    moveItem={moveItem}
                    listType="other"
                    isWide={isWide}
                    isAtMaxCapacity={false}
                  />
                )}
              </Box>
            </Box>
          </OtherElementsPaper>
        </Box>
      </Box>
    </DndProvider>
  );
}
