'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

interface Task {
  id: string;
  task_description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  estimated_time: number | null;
  completed_at: string | null;
  created_at: string;
  notes: string | null;
}

interface TaskPreferences {
  daily_prompt_time: string;
  timezone: string;
  checkin_frequency: number;
  max_daily_checkins: number;
  weekend_mode: boolean;
  notification_style: 'supportive' | 'direct' | 'motivational';
}

export default function TasksPage() {
  const { data: session } = useSession();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [preferences, setPreferences] = useState<TaskPreferences | null>(null);
  const [newTask, setNewTask] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [estimatedTime, setEstimatedTime] = useState<number | ''>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const priorityColors = {
    low: 'bg-gray-100 text-gray-700',
    medium: 'bg-blue-100 text-blue-700',
    high: 'bg-yellow-100 text-yellow-700',
    urgent: 'bg-red-100 text-red-700'
  };

  const priorityEmojis = {
    low: '🟢',
    medium: '🔵',
    high: '🟡',
    urgent: '🔴'
  };

  useEffect(() => {
    if (session) {
      fetchTasks();
      fetchPreferences();
    }
  }, [session]);

  const fetchTasks = async () => {
    try {
      const response = await fetch('/api/dashboard/tasks');
      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks || []);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPreferences = async () => {
    try {
      const response = await fetch('/api/dashboard/task-preferences');
      if (response.ok) {
        const data = await response.json();
        setPreferences(data.preferences);
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
    }
  };

  const addTask = async () => {
    if (!newTask.trim()) return;

    setSaving(true);
    try {
      const response = await fetch('/api/dashboard/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_description: newTask.trim(),
          priority: newTaskPriority,
          estimated_time: estimatedTime || null
        })
      });

      if (response.ok) {
        setNewTask('');
        setEstimatedTime('');
        setNewTaskPriority('medium');
        fetchTasks();
      }
    } catch (error) {
      console.error('Error adding task:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateTaskStatus = async (taskId: string, status: Task['status']) => {
    try {
      const response = await fetch('/api/dashboard/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId, status })
      });

      if (response.ok) {
        fetchTasks();
      }
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      const response = await fetch('/api/dashboard/tasks', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId })
      });

      if (response.ok) {
        fetchTasks();
      }
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const updatePreferences = async (newPreferences: Partial<TaskPreferences>) => {
    setSaving(true);
    try {
      const response = await fetch('/api/dashboard/task-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPreferences)
      });

      if (response.ok) {
        fetchPreferences();
      }
    } catch (error) {
      console.error('Error updating preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">Loading tasks...</div>
        </div>
      </div>
    );
  }

  const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const completionRate = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Daily Task Manager</h1>
          <p className="mt-2 text-gray-600">
            Manage your daily tasks and track productivity. Get AI-powered check-ins throughout the day!
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Total Tasks Today</div>
            <div className="text-3xl font-bold text-gray-900">{tasks.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Completed</div>
            <div className="text-3xl font-bold text-green-600">{completedTasks.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Pending</div>
            <div className="text-3xl font-bold text-blue-600">{pendingTasks.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Completion Rate</div>
            <div className="text-3xl font-bold text-purple-600">{completionRate}%</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Tasks Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Add New Task */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Add New Task</h2>
              <div className="space-y-4">
                <div>
                  <input
                    type="text"
                    placeholder="Enter task description..."
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyPress={(e) => e.key === 'Enter' && addTask()}
                  />
                </div>
                <div className="flex gap-4">
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value as any)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                    <option value="urgent">Urgent</option>
                  </select>
                  <input
                    type="number"
                    placeholder="Minutes"
                    value={estimatedTime}
                    onChange={(e) => setEstimatedTime(e.target.value ? parseInt(e.target.value) : '')}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-24"
                  />
                  <button
                    onClick={addTask}
                    disabled={saving || !newTask.trim()}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? 'Adding...' : 'Add Task'}
                  </button>
                </div>
              </div>
            </div>

            {/* Pending Tasks */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Pending Tasks ({pendingTasks.length})
              </h2>
              <div className="space-y-3">
                {pendingTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-md">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => updateTaskStatus(task.id, 'completed')}
                        className="w-5 h-5 rounded-full border-2 border-gray-300 hover:border-green-500 focus:border-green-500"
                      />
                      <div>
                        <div className="font-medium text-gray-900">{task.task_description}</div>
                        <div className="flex items-center space-x-2 text-sm text-gray-500">
                          <span className={`px-2 py-1 rounded-full text-xs ${priorityColors[task.priority]}`}>
                            {priorityEmojis[task.priority]} {task.priority}
                          </span>
                          {task.estimated_time && (
                            <span>~{task.estimated_time}min</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                ))}
                {pendingTasks.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No pending tasks. Great job! 🎉
                  </div>
                )}
              </div>
            </div>

            {/* Completed Tasks */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Completed Tasks ({completedTasks.length})
              </h2>
              <div className="space-y-2">
                {completedTasks.map((task) => (
                  <div key={task.id} className="flex items-center space-x-3 p-3 bg-green-50 border border-green-200 rounded-md">
                    <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 line-through">{task.task_description}</div>
                      <div className="text-sm text-gray-500">
                        Completed at {new Date(task.completed_at!).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
                {completedTasks.length === 0 && (
                  <div className="text-center py-4 text-gray-500">
                    No completed tasks yet today.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Settings Sidebar */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Task Preferences</h2>
              {preferences && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Daily Prompt Time
                    </label>
                    <input
                      type="time"
                      value={preferences.daily_prompt_time}
                      onChange={(e) => updatePreferences({ daily_prompt_time: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Check-in Frequency (hours)
                    </label>
                    <select
                      value={preferences.checkin_frequency}
                      onChange={(e) => updatePreferences({ checkin_frequency: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={2}>Every 2 hours</option>
                      <option value={3}>Every 3 hours</option>
                      <option value={4}>Every 4 hours</option>
                      <option value={6}>Every 6 hours</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notification Style
                    </label>
                    <select
                      value={preferences.notification_style}
                      onChange={(e) => updatePreferences({ notification_style: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="supportive">Supportive</option>
                      <option value="direct">Direct</option>
                      <option value="motivational">Motivational</option>
                    </select>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="weekend_mode"
                      checked={preferences.weekend_mode}
                      onChange={(e) => updatePreferences({ weekend_mode: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="weekend_mode" className="ml-2 block text-sm text-gray-900">
                      Enable weekend check-ins
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-blue-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">💡 How to Use</h3>
              <div className="text-sm text-blue-800 space-y-2">
                <p>Text the AI to manage tasks:</p>
                <ul className="list-disc ml-4 space-y-1">
                  <li>"My tasks today: call john, send email"</li>
                  <li>"Add task review proposal"</li>
                  <li>"Meeting done" to complete</li>
                  <li>"Show my tasks" to list all</li>
                </ul>
                <p className="mt-3">
                  You'll receive a daily prompt at {preferences?.daily_prompt_time} and periodic check-ins throughout the day.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}