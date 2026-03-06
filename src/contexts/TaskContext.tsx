import React, { createContext, useContext, useState } from 'react';

interface Task {
  id: string;
  title: string;
  description: string;
  position: {
    x: number;
    y: number;
    z: number;
  };
  status: 'enabled' | 'disabled';
  createdAt: Date;
}

interface TaskContextType {
  tasks: Task[];
  addTask: (task: Omit<Task, 'id' | 'createdAt'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  reorderTasks: (enabledTasks: Task[], disabledTasks: Task[]) => void;
}

const TaskContext = createContext<TaskContextType | null>(null);

interface TaskProviderProps {
  children: React.ReactNode;
}

export function TaskProvider({ children }: TaskProviderProps) {
  const [tasks, setTasks] = useState<Task[]>([]);

  const addTask = (task: Omit<Task, 'id' | 'createdAt'>) => {
    const newTask: Task = {
      ...task,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    };
    setTasks(prev => [...prev, newTask]);
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(task => (task.id === id ? { ...task, ...updates } : task)));
  };

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(task => task.id !== id));
  };

  const reorderTasks = (enabledTasks: Task[], disabledTasks: Task[]) => {
    setTasks([...enabledTasks, ...disabledTasks]);
  };

  const value = {
    tasks,
    addTask,
    updateTask,
    deleteTask,
    reorderTasks,
  };

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

export function useTask() {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error('useTask must be used within a TaskProvider');
  }
  return context;
}
