'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

export default function TasksPage() {
    const { data: session, status } = useSession();
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (status === 'authenticated') {
            fetchTasks();
        }
    }, [status]);

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

    if (status === 'loading') {
        return <div className="p-8">Loading...</div>;
    }

    if (status === 'unauthenticated') {
        return <div className="p-8">Please sign in to view tasks.</div>;
    }

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-6 text-white">Task Management</h1>

            <div className="glass-panel p-6 rounded-lg">
                <h2 className="text-lg font-semibold mb-4 text-white">Daily Tasks</h2>

                {loading ? (
                    <p className="text-gray-400">Loading tasks...</p>
                ) : tasks.length === 0 ? (
                    <p className="text-gray-400">No tasks for today. Task management system coming soon!</p>
                ) : (
                    <ul className="space-y-2">
                        {tasks.map((task: any, index: number) => (
                            <li key={index} className="text-white p-2 bg-gray-700 rounded">
                                {task.description || 'Task'}
                            </li>
                        ))}
                    </ul>
                )}

                <div className="mt-6">
                    <p className="text-sm text-gray-400">
                        Full task management features including SMS integration,
                        daily prompts, and AI check-ins will be available soon.
                    </p>
                </div>
            </div>
        </div>
    );
}