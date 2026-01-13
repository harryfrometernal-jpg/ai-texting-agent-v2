'use client';

import React, { useState, useEffect } from 'react';

import {
    LayoutDashboard as HomeIcon,
    Users as UsersIcon,
    Activity as ActivityIcon,
    Settings as SettingsIcon,
    LogOut as LogoutIcon,
    Plus as PlusIcon,
    Trash2 as TrashIcon,
    MessageSquare as MessageIcon,
    ArrowUpRight as ArrowUpIcon,
    ArrowDownLeft as ArrowDownIcon,
    Book as BookIcon,
    BarChart3 as ChartIcon,
    PieChart as PieChartIcon,
    DollarSign as DollarIcon,
    Phone as PhoneIcon,
    CreditCard as CreditCardIcon,
    PauseCircle as PauseIcon,
    PlayCircle as PlayIcon,
    Send as SendIcon,
    User as UserIcon,
    Mic as MicIcon,
    Play as PlaySmallIcon,
    Megaphone as MegaphoneIcon,
    CheckCircle2 as CheckIcon,
    Globe as GlobeIcon,
    Sparkles as SparklesIcon,
    Building as BuildingIcon,
    Mail as MailIcon,
    MessageSquare as SmsIcon,
    Search as SearchIcon,
    ShieldCheck as ShieldCheckIcon,
    Target as TargetIcon
} from 'lucide-react';
import { NavButton, StatCard, Skeleton, MobileHeader } from './components';



export default function Dashboard() {
    const [whitelist, setWhitelist] = useState<any[]>([]); // Admins/Authorized Users
    const [contacts, setContacts] = useState<any[]>([]); // Leads/CRM
    const [isImporting, setIsImporting] = useState(false);
    const [newPhone, setNewPhone] = useState('');
    const [documents, setDocuments] = useState<any[]>([]);
    const [newDocContent, setNewDocContent] = useState('');
    const [trainUrl, setTrainUrl] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [logs, setLogs] = useState<any[]>([]);
    const [stats, setStats] = useState({
        totalWhitelisted: 0,
        totalLogs: 0,
        interactionsToday: 0,
        sentiment: { positive: 0, neutral: 0, negative: 0 },
        costs: { total: 0, vapi: 0 },
        callsTriggered: 0
    });
    const [activeTab, setActiveTab] = useState('overview');
    const [isSidebarOpen, setSidebarOpen] = useState(true);
    const [numbers, setNumbers] = useState<any[]>([]);

    // SaaS State
    const [orgs, setOrgs] = useState<any[]>([]); // List of orgs
    const [activeOrg, setActiveOrg] = useState<any>(null); // Current org context
    const [newOrgName, setNewOrgName] = useState("");
    const [brandColor, setBrandColor] = useState("#10b981"); // Default Emerald
    const [brandLogo, setBrandLogo] = useState("");
    const [ghlWebhook, setGhlWebhook] = useState("");

    // Live Chat State
    const [selectedContact, setSelectedContact] = useState<any>(null);
    const [chatHistory, setChatHistory] = useState<any[]>([]);
    const [manualMessage, setManualMessage] = useState("");
    const [activeChannel, setActiveChannel] = useState<'sms' | 'email'>('sms');
    const [swarmMode, setSwarmMode] = useState(false); // Enable The Hive
    const [sending, setSending] = useState(false);

    // Voice Hub State
    const [calls, setCalls] = useState<any[]>([]);
    const [playingAudio, setPlayingAudio] = useState<string | null>(null);

    // Broadcast State
    const [campaignGoal, setCampaignGoal] = useState("");
    const [campaignGoalB, setCampaignGoalB] = useState("");
    const [isABTest, setIsABTest] = useState(false);
    const [broadcasting, setBroadcasting] = useState(false);
    const [activeCampaign, setActiveCampaign] = useState<any>(null);
    const [queueStats, setQueueStats] = useState<any>(null);
    const [campaigns, setCampaigns] = useState<any[]>([]); // Added missing state

    // Headhunter State
    const [targetUrl, setTargetUrl] = useState("");
    const [targetNiche, setTargetNiche] = useState("Real Estate");
    const [targetCity, setTargetCity] = useState("Miami, FL");
    const [researching, setResearching] = useState(false);
    const [generatedOpener, setGeneratedOpener] = useState("");
    const [foundLeads, setFoundLeads] = useState<any[]>([]);

    // Goal Management State
    const [goalModalOpen, setGoalModalOpen] = useState(false);
    const [selectedGoalPhone, setSelectedGoalPhone] = useState("");
    const [newGoalDesc, setNewGoalDesc] = useState("");
    const [newGoalType, setNewGoalType] = useState("qualification");

    // Hydration State for Lazy Loading
    const [hydratedTabs, setHydratedTabs] = useState<Set<string>>(new Set(['overview']));
    const [tabLoading, setTabLoading] = useState<Record<string, boolean>>({});


    const toggleAIStatus = async (contact: any) => {
        const newStatus = contact.ai_status === 'paused' ? 'active' : 'paused';
        try {
            await fetch('/api/dashboard/whitelist', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: contact.id, ai_status: newStatus })
            });
            setNumbers(numbers.map(n => n.id === contact.id ? { ...n, ai_status: newStatus } : n));
            if (selectedContact?.id === contact.id) setSelectedContact({ ...selectedContact, ai_status: newStatus });
        } catch (e) {
            alert("Failed to update status");
        }
    };

    const sendManualMessage = async () => {
        if (!manualMessage.trim() || !selectedContact) return;
        setSending(true);
        try {
            // Send Message (Simulated for Demo)
            const res = await fetch('/api/dashboard/logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contact_phone: selectedContact.phone_number,
                    direction: 'outbound',
                    content: manualMessage,
                    agent_used: 'human',
                    channel: activeChannel,
                    org_id: activeOrg.id
                })
            });
            const { error } = await res.json();

            if (activeChannel === 'email') {
                // Call our (mock) API to send email
                // await fetch('/api/email/send', ... )
                alert(`Email sent to ${selectedContact.phone_number} (simulated)`);
            } else {
                // In a real production app, you would verify GHL received this via API
            }

            setManualMessage("");
            if (!error) fetchData(); // Refresh logs

            if (swarmMode) {
                // Trigger Swarm Debate in background (Client-side simulation for demo speed, usually server)
                // In reality, you'd hit /api/swarm
                runSwarmDemo(manualMessage);
            }

        } catch (e) {
            console.error(e);
        } finally {
            setSending(false);
        }
    };

    // Load Chat History when contact selected
    // Chat fetch handled by unified effect below

    useEffect(() => {
        // Initial Orgs fetch handled by main fetchData
    }, []);

    const [healthStatus, setHealthStatus] = useState<'healthy' | 'degraded' | 'checking'>('checking');

    useEffect(() => {
        // Initial Health Check
        checkHealth();
    }, []);

    const checkHealth = async () => {
        // In reality, you'd check a stored status or call the API
        // For demo, we assume healthy but let user trigger it
        setHealthStatus('healthy');
    };

    const triggerGuardian = async () => {
        setHealthStatus('checking');
        try {
            const res = await fetch('/api/cron/guardian');
            if (res.ok) {
                setHealthStatus('healthy');
                alert("Guardian: System is Healthy! ✅");
                fetchData(); // Refresh logs to see the check
            } else {
                setHealthStatus('degraded');
                alert("Guardian: System Issues Detected! ❌");
            }
        } catch (e) {
            setHealthStatus('degraded');
        }
    };

    useEffect(() => {
        if (activeOrg) {
            // Apply Org Branding
            setBrandColor(activeOrg.brand_color || "#10b981");
            setBrandLogo(activeOrg.logo_url || "");
            setGhlWebhook(activeOrg.ghl_webhook_url || "");

            // Reset hydration when org changes
            setHydratedTabs(new Set(['overview']));
            fetchData();
        }
    }, [activeOrg]);

    useEffect(() => {
        if (activeOrg && activeTab !== 'overview' && !hydratedTabs.has(activeTab)) {
            hydrateTab(activeTab);
        }
    }, [activeTab, activeOrg]);

    const hydrateTab = async (tab: string) => {
        if (!activeOrg) return;
        setTabLoading(prev => ({ ...prev, [tab]: true }));
        try {
            console.log(`[Hydration] Loading full data for ${tab}...`);
            let res;
            if (tab === 'whitelist') { // Contacts
                res = await fetch(`/api/dashboard/whitelist?org_id=${activeOrg.id}`);
                const data = await res.json();
                if (Array.isArray(data)) {
                    setContacts(data);
                    setHydratedTabs(prev => new Set(prev).add('whitelist'));
                }
            } else if (tab === 'logs') {
                res = await fetch(`/api/dashboard/logs?org_id=${activeOrg.id}`);
                const data = await res.json();
                if (Array.isArray(data)) {
                    setLogs(data);
                    setHydratedTabs(prev => new Set(prev).add('logs'));
                }
            } else if (tab === 'campaigns') {
                res = await fetch(`/api/dashboard/campaigns?org_id=${activeOrg.id}`);
                const data = await res.json();
                if (Array.isArray(data)) {
                    setCampaigns(data);
                    setHydratedTabs(prev => new Set(prev).add('campaigns'));
                }
            }
        } catch (e) {
            console.error(`Hydration error for ${tab}:`, e);
        } finally {
            setTabLoading(prev => ({ ...prev, [tab]: false }));
        }
    };

    const saveBranding = async () => {
        if (!activeOrg) {
            alert("Error: No Active Organization found. Please create one in the sidebar.");
            return;
        }

        try {
            const res = await fetch('/api/dashboard/org', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: activeOrg.id,
                    brand_color: brandColor,
                    logo_url: brandLogo,
                    ghl_webhook_url: ghlWebhook
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error);
            }

            const updatedOrg = await res.json();

            // Fix: Immediately update local state to reflect changes
            setActiveOrg(updatedOrg);
            setOrgs(prev => prev.map(o => o.id === updatedOrg.id ? updatedOrg : o));

            alert("Settings Saved Successfully!");
            // fetchData(); // Optional now, since we updated manually

        } catch (e: any) {
            console.error("Unexpected Error:", e);
            alert(`Error: ${e.message || e}`);
        }
    };

    const runSwarmDemo = async (userMsg: string) => {
        // simulate a user reply triggering the swarm
        const logMsg = async (content: string, direction: string, agent: string, channel: string) => {
            await fetch('/api/dashboard/logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contact_phone: selectedContact.phone_number,
                    direction, content, agent_used: agent, channel, org_id: activeOrg.id
                })
            });
            fetchData();
        };

        setTimeout(async () => {
            await logMsg("How much is it?", "inbound", "customer_sim", "sms");
            await logMsg("🐝 SA: I'll say $500 right now!", "outbound", "swarm_sales", "internal");
            await new Promise(r => setTimeout(r, 1000));
            await logMsg("🛡️ RA: Too aggressive. Ask about needs first.", "outbound", "swarm_risk", "internal");
            await new Promise(r => setTimeout(r, 1000));
            await logMsg("👔 Manager: It depends on the scope. Can you tell me more about what you need fixed?", "outbound", "swarm_manager", "sms");
        }, 2000);
    };

    const [isLoading, setIsLoading] = useState(true);

    async function fetchData() {
        try {
            const res = await fetch('/api/dashboard/init');
            const data = await res.json();

            if (data.error) return console.error(data.error);

            if (data.orgs) {
                setOrgs(data.orgs);
                if (!activeOrg && data.orgs.length > 0) setActiveOrg(data.orgs[0]);
            }

            // Map API structure to local states, but don't overwrite hydrated full lists with small init sets
            if (!hydratedTabs.has('whitelist')) setWhitelist(data.whitelist || []);

            if (!hydratedTabs.has('whitelist')) {
                setContacts(data.contacts || []);
            } else {
                // Merge if needed, but for now just don't overwrite full list with small one
                // In a real app, you'd prepend new items
            }

            if (!hydratedTabs.has('logs')) {
                setLogs(data.logs || []);
            }

            if (!hydratedTabs.has('campaigns')) {
                setCampaigns(data.campaigns || []);
            }

            setDocuments(data.documents || []);

            // Use Server-side stats if available
            if (data.stats) {
                setStats({
                    totalWhitelisted: data.stats.totalContacts,
                    totalLogs: data.stats.totalLogs,
                    interactionsToday: data.stats.interactionsToday,
                    sentiment: { positive: 0, neutral: 0, negative: 0 },
                    costs: { total: 0, vapi: 0 },
                    callsTriggered: 0
                });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    }

    // Unified Fetch Logic
    const fetchChat = async () => {
        if (!selectedContact || !activeOrg) return;
        try {
            const res = await fetch(`/api/dashboard/logs?phone=${encodeURIComponent(selectedContact.phone_number)}&org_id=${activeOrg.id}`);
            const data = await res.json();
            if (Array.isArray(data)) setChatHistory(data);
        } catch (e) { console.error("Chat polling error", e); }
    };

    // Initial Load & Polling
    useEffect(() => {
        fetchData();
        const interval = setInterval(() => {
            fetchData();
            // Poll chat if a contact is selected
            if (selectedContact) fetchChat();
        }, 5000);
        return () => clearInterval(interval);
    }, [selectedContact, activeOrg]); // Add dependencies so interval refreshes with current state

    // Also fetch immediately on selection
    useEffect(() => {
        if (selectedContact) fetchChat();
    }, [selectedContact, activeOrg]);

    const createOrg = async () => {
        if (!newOrgName.trim()) return;
        try {
            const res = await fetch('/api/dashboard/org', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newOrgName })
            });
            const data = await res.json();
            if (data.id) {
                setOrgs([...orgs, data]);
                setActiveOrg(data);
                setNewOrgName("");
                alert("Organization created!");
            }
        } catch (e) {
            alert("Failed to create org");
        }
    };



    const uploadDocument = async () => {
        if (!newDocContent) return;
        setIsUploading(true);
        try {
            const res = await fetch('/api/documents/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: newDocContent, filename: 'manual_entry', org_id: activeOrg.id }) // Add org_id
            });
            if (res.ok) {
                setNewDocContent('');
                fetchData();
                alert('Document added to Knowledge Base!');
            } else {
                alert('Failed to upload document.');
            }
        } catch (e) {
            console.error(e);
            alert('Error uploading document.');
        } finally {
            setIsUploading(false);
        }
    };

    const trainFromUrl = async () => {
        if (!trainUrl.trim()) return;
        setIsUploading(true);
        try {
            const res = await fetch('/api/knowledge/train-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: trainUrl, org_id: activeOrg.id }) // Add org_id
            });
            const data = await res.json();
            if (res.ok) {
                setTrainUrl('');
                fetchData();
                alert(`Success! Learned from ${data.chunks} segments of "${data.title}"`);
            } else {
                alert('Failed: ' + data.error);
            }
        } catch (e) {
            console.error(e);
            alert('Error training from URL');
        } finally {
            setIsUploading(false);
        }
    };

    const addNumber = async () => {
        if (!newPhone) return;
        if (!activeOrg) return alert("Please select an organization first.");

        try {
            const res = await fetch('/api/dashboard/whitelist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: newPhone, org_id: activeOrg.id })
            });
            if (res.ok) {
                setNewPhone('');
                fetchData();
                alert("Number added successfully!");
            } else {
                alert("Failed to add number (might be duplicate)");
            }
        } catch (e: any) {
            alert("Error adding number");
        }
    };


    const deleteNumber = async (id: string) => {
        if (!confirm("Are you sure?")) return;
        try {
            const res = await fetch(`/api/dashboard/whitelist?id=${id}`, { method: 'DELETE' });
            if (res.ok) fetchData();
            else alert("Failed to delete");
        } catch (e) { alert("Error deleting"); }
    };

    const addAdminNumber = async () => {
        console.log('🔍 Adding admin number:', {
            newPhone,
            activeOrg,
            hasPhone: !!newPhone,
            hasOrg: !!activeOrg
        });

        if (!newPhone) {
            alert('Please enter a phone number');
            return;
        }

        if (!activeOrg) {
            console.error('No active organization found:', { orgs, activeOrg });
            alert('No organization selected. Please refresh the page and try again.');
            return;
        }

        try {
            console.log('📞 Making API call to add admin...');
            const res = await fetch('/api/dashboard/admin-whitelist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: newPhone, org_id: activeOrg.id, role: 'member' })
            });

            const data = await res.json();
            console.log('📋 API Response:', { status: res.status, data });

            if (res.ok) {
                console.log('✅ Successfully added admin user');
                setNewPhone('');
                fetchData();
                alert(`Successfully authorized user: ${newPhone}`);
            } else {
                console.error('❌ API Error:', data.error);
                alert(data.error || 'Failed to authorize user');
            }
        } catch (e) {
            console.error('💥 Network/JS Error:', e);
            alert("Error adding admin: " + (e as Error).message);
        }
    };

    const deleteAdminNumber = async (id: string) => {
        if (!confirm("Remove admin access?")) return;
        try {
            const res = await fetch(`/api/dashboard/admin-whitelist?id=${id}`, { method: 'DELETE' });
            if (res.ok) fetchData();
            else alert("Failed to delete");
        } catch (e) { alert("Error deleting"); }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'csv' | 'vcard') => {
        const file = e.target.files?.[0];
        if (!file || !activeOrg) return;

        setIsImporting(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('org_id', activeOrg.id);

        try {
            const res = await fetch('/api/contacts/upload', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();

            if (res.ok) {
                alert(`Success! Imported: ${data.imported}, Failed: ${data.failed}`);
                fetchData();
            } else {
                alert("Import failed: " + data.error);
            }
        } catch (error) {
            console.error(error);
            alert("Upload error");
        } finally {
            setIsImporting(false);
            e.target.value = ''; // Reset input
        }
    };

    const exportLogs = () => {
        if (!logs.length) return;
        const headers = ['ID', 'Created At', 'Direction', 'Agent', 'Content'];
        const csvContent = [
            headers.join(','),
            ...logs.map(log => [
                log.id,
                log.created_at,
                log.direction,
                log.agent_used || 'system',
                `"${log.content.replace(/"/g, '""')}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `logs_export_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const clearHistory = async () => {
        if (!confirm('Clear ALL history?')) return;
        try {
            await fetch('/api/dashboard/logs', { method: 'DELETE' });
            fetchData();
            alert('History cleared.');
        } catch (e) { alert('Failed to clear'); }
    };

    const createCampaign = async () => {
        if (!campaignGoal.trim()) return;
        setBroadcasting(true);
        try {
            if (isABTest && campaignGoalB.trim()) {
                // A/B Split Logic
                const shuffled = [...contacts].sort(() => 0.5 - Math.random());
                const splitIndex = Math.floor(shuffled.length / 2);
                const groupA = shuffled.slice(0, splitIndex).map(c => c.id);
                const groupB = shuffled.slice(splitIndex).map(c => c.id);

                // Launch A
                await fetch('/api/broadcast/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ goal: campaignGoal, contactIds: groupA, org_id: activeOrg.id }) // Add org_id
                });

                // Launch B
                await fetch('/api/broadcast/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ goal: campaignGoalB, contactIds: groupB, org_id: activeOrg.id }) // Add org_id
                });

                alert(`launched A/B Test! Group A: ${groupA.length}, Group B: ${groupB.length}`);
                setCampaignGoal("");
                setCampaignGoalB("");
                setIsABTest(false);
            } else {
                // Standard Logic
                const res = await fetch('/api/broadcast/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ goal: campaignGoal, contactIds: [], org_id: activeOrg.id }) // Add org_id
                });
                const data = await res.json();
                if (data.success) {
                    alert(`Campaign Created! ${data.count} contacts queued.`);
                    setCampaignGoal("");
                    fetchCampaignStats(data.campaignId);
                }
            }
        } catch (e) {
            console.error(e);
            alert("Failed to create campaign.");
        } finally {
            setBroadcasting(false);
        }
    };

    const fetchCampaignStats = async (campId: string) => {
        // Fetch queue progress (mock logic for now, or simple query if we had endpoint)
        // For demo, we just set active state. Real app would poll /api/campaigns/:id
        setActiveCampaign({ id: campId, goal: campaignGoal });
    };

    const handleSetGoal = async () => {
        if (!selectedGoalPhone || !newGoalDesc) return;
        try {
            const res = await fetch('/api/dashboard/set-goal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contactPhone: selectedGoalPhone,
                    goalDescription: newGoalDesc,
                    goalType: newGoalType
                })
            });
            if (res.ok) {
                setGoalModalOpen(false);
                setNewGoalDesc("");
                fetchData();
                alert("Goal activated for contact!");
            } else {
                alert("Failed to set goal");
            }
        } catch (e) {
            console.error(e);
            alert("Error setting goal");
        }
    };


    // Poll for queue progress if active campaign exists
    // Poll for queue progress if active campaign exists
    useEffect(() => {
        // We already poll fetchData, but campaign stats might need specific endpoint
        // For now just skip specific polling or rely on main fetchData if we added queue stats there
        // Or add simple client side filter
    }, [activeCampaign]);

    // Manual Trigger for Demo
    const triggerDrip = async () => {
        await fetch('/api/cron/drip');
    };



    const runHeadhunter = async () => {
        if (!targetUrl.trim()) return;
        setResearching(true);
        setGeneratedOpener("");
        try {
            const res = await fetch('/api/headhunter/research', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: targetUrl, myBusinessDesc: "Advanced AI Automation & Chatbots", org_id: activeOrg.id }) // Add org_id
            });
            const data = await res.json();
            if (data.opener) setGeneratedOpener(data.opener);
            else if (data.error) setGeneratedOpener("Error: " + data.error);
        } catch (e) {
            console.error(e);
            setGeneratedOpener("Failed to research.");
        } finally {
            setResearching(false);
        }
    };

    const runHeadhunterMaps = async () => {
        if (!targetNiche || !targetCity) return;
        setResearching(true);
        setFoundLeads([]);
        try {
            const res = await fetch('/api/headhunter/maps', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ niche: targetNiche, city: targetCity, org_id: activeOrg.id })
            });
            const data = await res.json();
            if (data.leads) {
                setFoundLeads(data.leads);
                alert(`Headhunter found ${data.leads.length} leads!`);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setResearching(false);
        }
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'billing':
                return (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-2xl font-bold text-white">Billing & Usage</h3>
                                <p className="text-slate-400">Manage your subscription and view usage history.</p>
                            </div>
                            <button onClick={() => alert("Redirecting to Stripe Customer Portal...")} className="bg-emerald-500 hover:bg-emerald-400 text-[#0a0a0c] px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all">
                                <CreditCardIcon className="w-4 h-4" /> Manage Subscription
                            </button>
                        </div>

                        {/* Current Plan Card */}
                        <div className="relative overflow-hidden glass-panel p-8 rounded-2xl border border-white/5 group">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full filter blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-emerald-500/20 transition-all duration-700"></div>
                            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <h2 className="text-3xl font-bold text-white">Pro Plan</h2>
                                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider">Active</span>
                                    </div>
                                    <p className="text-slate-400 max-w-md">Your plan renews on <span className="text-slate-200 font-semibold">Dec 24, 2025</span>. You have used <span className="text-emerald-400 font-semibold">{stats.totalLogs}</span> of your included messages.</p>
                                </div>
                                <div className="text-right">
                                    <div className="text-4xl font-bold text-white">$299<span className="text-lg text-slate-500 font-normal">/mo</span></div>
                                    <div className="text-sm text-slate-500 mt-1">Unlimited Agents & Calendars</div>
                                </div>
                            </div>

                            {/* Usage Progress */}
                            <div className="mt-8 space-y-2">
                                <div className="flex justify-between text-sm text-slate-300 font-medium">
                                    <span>Monthly Message Volume</span>
                                    <span>{stats.totalLogs} / 10,000</span>
                                </div>
                                <div className="h-3 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
                                    <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500" style={{ width: `${Math.min((stats.totalLogs / 10000) * 100, 100)}%` }}></div>
                                </div>
                                <p className="text-xs text-slate-500 text-right">{(stats.totalLogs / 10000 * 100).toFixed(1)}% Used</p>
                            </div>
                        </div>

                        {/* Invoice History Table */}
                        <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
                            <div className="p-6 border-b border-white/5">
                                <h3 className="text-lg font-semibold text-white">Invoice History</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-white/5 text-slate-400 text-xs uppercase font-semibold">
                                        <tr>
                                            <th className="px-6 py-4">Invoice ID</th>
                                            <th className="px-6 py-4">Date</th>
                                            <th className="px-6 py-4">Amount</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        <tr className="group hover:bg-white/[0.02] transition-colors">
                                            <td className="px-6 py-4 text-slate-300 font-medium font-mono text-sm">INV-2024-001</td>
                                            <td className="px-6 py-4 text-slate-400 text-sm">Nov 24, 2025</td>
                                            <td className="px-6 py-4 text-white font-medium">$299.00</td>
                                            <td className="px-6 py-4"><span className="bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded text-xs font-bold">PAID</span></td>
                                            <td className="px-6 py-4 text-right"><button className="text-slate-400 hover:text-white transition-colors text-sm">Download</button></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <div className="p-6 text-center border-t border-white/5 text-sm text-slate-500">
                                This is a demo billing view. Integration with Stripe typically uses the Customer Portal.
                            </div>
                        </div>
                    </div>
                );

            case 'chat':
                return (
                    <div className="flex h-[calc(100vh-140px)] gap-6 animate-in fade-in duration-500">
                        {/* Contact List */}
                        <div className="w-1/3 glass-panel rounded-2xl border border-white/5 overflow-hidden flex flex-col">
                            <div className="p-4 border-b border-white/5 bg-white/[0.02]">
                                <h3 className="font-semibold text-white">Contacts</h3>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                {numbers.map(num => (
                                    <button
                                        key={num.id}
                                        onClick={() => setSelectedContact(num)}
                                        className={`w-full text-left p-3 rounded-lg transition-all flex items-center justify-between group ${selectedContact?.id === num.id ? 'bg-emerald-500/20 border border-emerald-500/30' : 'hover:bg-white/5 border border-transparent'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400">
                                                {num.name ? num.name[0] : '#'}
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-white">{num.name || 'Unknown'}</div>
                                                <div className="text-xs text-slate-500 opacity-80">{num.phone_number}</div>
                                            </div>
                                        </div>
                                        {num.ai_status === 'paused' && <PauseIcon className="w-4 h-4 text-amber-500" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Chat Window */}
                        <div className="flex-1 glass-panel rounded-2xl border border-white/5 overflow-hidden flex flex-col">
                            {selectedContact ? (
                                <>
                                    {/* Header */}
                                    <div className="p-4 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <h3 className="font-bold text-white">{selectedContact.name || selectedContact.phone_number}</h3>
                                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${selectedContact.ai_status === 'paused' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'}`}>
                                                {selectedContact.ai_status === 'paused' ? 'AI Paused' : 'AI Active'}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => toggleAIStatus(selectedContact)}
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${selectedContact.ai_status === 'paused' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20' : 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20'}`}
                                        >
                                            {selectedContact.ai_status === 'paused' ? <PlayIcon className="w-3 h-3" /> : <PauseIcon className="w-3 h-3" />}
                                            {selectedContact.ai_status === 'paused' ? 'Resume AI' : 'Pause AI'}
                                        </button>
                                    </div>

                                    {/* Messages */}
                                    <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-black/20">
                                        {chatHistory.length === 0 ? (
                                            <div className="text-center text-slate-500 text-sm mt-10">No messages yet. Start the conversation!</div>
                                        ) : (
                                            chatHistory.map(msg => (
                                                <div key={msg.id} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                                                    <div className={`max-w-[70%] p-3 rounded-2xl text-sm leading-relaxed border ${msg.direction === 'outbound'
                                                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-100 rounded-tr-none'
                                                        : 'bg-white/10 border-white/10 text-white rounded-tl-none'
                                                        }`}>
                                                        {msg.content}
                                                        <div className="flex justify-between items-center mt-1 gap-4 opacity-50">
                                                            <span className="text-[10px]">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                            {msg.agent_used && <span className="text-[10px] uppercase tracking-wide">{msg.agent_used}</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    {/* Input */}
                                    <div className="p-4 border-t border-white/5 bg-white/[0.02]">
                                        {/* Channel Toggle */}
                                        <div className="flex items-center gap-2 mb-2 p-1 bg-white/5 rounded-lg w-fit">
                                            <button
                                                onClick={() => setActiveChannel('sms')}
                                                className={`p-2 rounded flex items-center gap-2 text-xs font-bold transition-all ${activeChannel === 'sms' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                            >
                                                <SmsIcon className="w-3 h-3" /> SMS
                                            </button>
                                            <button
                                                onClick={() => setActiveChannel('email')}
                                                className={`p-2 rounded flex items-center gap-2 text-xs font-bold transition-all ${activeChannel === 'email' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                            >
                                                <MailIcon className="w-3 h-3" /> Email
                                            </button>
                                        </div>

                                        {/* Swarm Toggle */}
                                        <div className="mb-2 flex items-center gap-2">
                                            <label className="flex items-center gap-2 cursor-pointer group">
                                                <input type="checkbox" checked={swarmMode} onChange={(e) => setSwarmMode(e.target.checked)} className="hidden" />
                                                <div className={`w-8 h-4 rounded-full relative transition-all ${swarmMode ? 'bg-amber-500' : 'bg-slate-700'}`}>
                                                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${swarmMode ? 'left-4.5' : 'left-0.5'}`} />
                                                </div>
                                                <span className={`text-xs font-bold ${swarmMode ? 'text-amber-400' : 'text-slate-500 group-hover:text-slate-400'}`}>
                                                    🐝 The Hive {swarmMode ? '(Active)' : '(Off)'}
                                                </span>
                                            </label>
                                        </div>

                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={manualMessage}
                                                onChange={(e) => setManualMessage(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && sendManualMessage()}
                                                placeholder={activeChannel === 'email' ? "Subject: Hello..." : "Type a message..."}
                                                className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition-all"
                                            />
                                            <button
                                                onClick={sendManualMessage}
                                                disabled={sending || !manualMessage.trim()}
                                                className={`p-3 rounded-xl transition-all ${activeChannel === 'email' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-blue-600 hover:bg-blue-500'} text-white shadow-lg shadow-blue-500/20`}
                                            >
                                                <SendIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                                    <MessageIcon className="w-12 h-12 mb-4 opacity-20" />
                                    <p>Select a contact to view chat</p>
                                </div>
                            )}
                        </div>
                    </div>
                );

            case 'voice':
                return (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-2xl font-bold text-white">Voice Intelligence Hub</h3>
                                <p className="text-slate-400">Review recordings, transcripts, and call analytics.</p>
                            </div>
                        </div>

                        {/* Recent Calls Table */}
                        <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
                            <div className="p-6 border-b border-white/5">
                                <h3 className="text-lg font-semibold text-white">Recent Calls</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-white/5 text-slate-400 text-xs uppercase font-semibold">
                                        <tr>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4">Customer</th>
                                            <th className="px-6 py-4">Duration/Time</th>
                                            <th className="px-6 py-4">Summary</th>
                                            <th className="px-6 py-4 text-right">Recording</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {calls.length === 0 ? (
                                            <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">No calls found yet. Trigger a call to populate.</td></tr>
                                        ) : (
                                            calls.map(call => (
                                                <tr key={call.id} className="group hover:bg-white/[0.02] transition-colors">
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${call.status === 'ended' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                                            {call.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-white font-mono text-sm">{call.customer?.number || 'Unknown'}</td>
                                                    <td className="px-6 py-4 text-slate-400 text-sm">
                                                        <div>{new Date(call.startedAt).toLocaleString()}</div>
                                                        {/* Duration calc could go here if endedAt exists */}
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-300 text-sm max-w-xs truncate" title={call.analysis?.summary}>
                                                        {call.analysis?.summary || 'No summary available.'}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        {call.recordingUrl ? (
                                                            <div className="flex justify-end gap-2">
                                                                <audio src={call.recordingUrl} controls className="h-8 w-48" />
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-600 text-xs">No Audio</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                );

            case 'campaigns':
                return (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-2xl font-bold text-white">Smart Campaigns</h3>
                                <p className="text-slate-400">Send personalized AI broadcasts to your audience.</p>
                            </div>
                        </div>

                        <div className="glass-panel p-8 rounded-2xl border border-white/5 space-y-6">
                            <div>
                                <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><GlobeIcon className="w-5 h-5 text-blue-400" /> Headhunter Mode (Cold Outreach)</h4>
                                <h3 className="text-xl font-bold text-white mb-2">Campaign Research</h3>
                                <p className="text-slate-400 mb-6">Use AI to find leads or analyze websites.</p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                    {/* Website Analyzer */}
                                    <div className="bg-black/40 border border-white/10 rounded-xl p-6">
                                        <h4 className="font-bold text-white mb-4 flex items-center gap-2">
                                            <GlobeIcon className="w-4 h-4 text-purple-400" /> Website Analyzer
                                        </h4>
                                        <input
                                            value={targetUrl}
                                            onChange={(e) => setTargetUrl(e.target.value)}
                                            placeholder="https://example.com"
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white mb-4 placeholder:text-slate-600"
                                        />
                                        <button
                                            onClick={runHeadhunter}
                                            disabled={researching}
                                            className="w-full bg-purple-600 hover:bg-purple-500 text-white rounded-lg py-2 font-medium transition-all"
                                        >
                                            {researching ? "Analyzing..." : "Analyze Site"}
                                        </button>
                                    </div>

                                    {/* Lead Finder (Maps) */}
                                    <div className="bg-black/40 border border-white/10 rounded-xl p-6">
                                        <h4 className="font-bold text-white mb-4 flex items-center gap-2">
                                            <SearchIcon className="w-4 h-4 text-emerald-400" /> Local Lead Finder
                                        </h4>
                                        <div className="space-y-3 mb-4">
                                            <input
                                                value={targetNiche}
                                                onChange={(e) => setTargetNiche(e.target.value)}
                                                placeholder="Niche (e.g. Plumbers)"
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder:text-slate-600"
                                            />
                                            <input
                                                value={targetCity}
                                                onChange={(e) => setTargetCity(e.target.value)}
                                                placeholder="City (e.g. Austin, TX)"
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder:text-slate-600"
                                            />
                                        </div>
                                        <button
                                            onClick={runHeadhunterMaps}
                                            disabled={researching}
                                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg py-2 font-medium transition-all"
                                        >
                                            {researching ? "Scraping Maps..." : "Find Leads"}
                                        </button>
                                    </div>
                                </div>

                                <div className="w-full h-px bg-white/10 my-8"></div>

                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-sm font-semibold text-slate-300">Campaign Goal / Topic</label>
                                        <div className="flex items-center gap-2">
                                            <label className="text-xs text-slate-400 font-bold uppercase cursor-pointer">
                                                Enable A/B Test
                                            </label>
                                            <input
                                                type="checkbox"
                                                checked={isABTest}
                                                onChange={(e) => setIsABTest(e.target.checked)}
                                                className="w-4 h-4 accent-emerald-500 cursor-pointer"
                                            />
                                        </div>
                                    </div>

                                    <textarea
                                        value={campaignGoal}
                                        onChange={(e) => setCampaignGoal(e.target.value)}
                                        placeholder={isABTest ? "Variation A: e.g. Friendly Check-in" : "e.g. Tell everyone about our Black Friday deal..."}
                                        className={`w-full ${isABTest ? 'h-24' : 'h-32'} bg-black/50 border border-white/10 rounded-xl p-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition-all resize-none mb-4`}
                                    />

                                    {isABTest && (
                                        <div className="animate-in slide-in-from-top-4 duration-300">
                                            <label className="block text-sm font-semibold text-slate-300 mb-2">Variation B Goal</label>
                                            <textarea
                                                value={campaignGoalB}
                                                onChange={(e) => setCampaignGoalB(e.target.value)}
                                                placeholder="Variation B: e.g. Urgent Deadline Warning"
                                                className="w-full h-24 bg-black/50 border border-white/10 rounded-xl p-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500/50 transition-all resize-none"
                                            />
                                            <p className="text-xs text-slate-500 mt-2">The contact list will be split 50/50 randomly between these two goals.</p>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="text-sm text-slate-400">
                                        Targeting: <span className="text-white font-bold">{contacts.length} Contacts</span> (All Available)
                                    </div>
                                    <div className="flex gap-2">
                                        {/* Hidden 'Force Run' button for demo purposes */}
                                        {activeCampaign && (
                                            <button onClick={triggerDrip} className="text-xs text-slate-500 hover:text-white underline">
                                                (Debug) Force Drip Batch
                                            </button>
                                        )}
                                        <button
                                            onClick={createCampaign}
                                            disabled={broadcasting || !campaignGoal.trim()}
                                            className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-[#0a0a0c] px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition-all"
                                        >
                                            {broadcasting ? (
                                                <>Queueing...</>
                                            ) : (
                                                <><MegaphoneIcon className="w-4 h-4" /> Launch Drip Campaign</>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {activeCampaign && queueStats && (
                                    <div className="mt-6 p-6 bg-white/5 border border-white/10 rounded-xl space-y-3">
                                        <div className="flex justify-between items-center">
                                            <h4 className="text-white font-bold">Active Campaign Progress</h4>
                                            <span className="text-xs text-emerald-400 font-mono bg-emerald-500/10 px-2 py-1 rounded">Status: RUNNING</span>
                                        </div>
                                        <div className="h-4 w-full bg-black/50 rounded-full overflow-hidden border border-white/5">
                                            <div
                                                className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-500"
                                                style={{ width: `${(queueStats.sent / (queueStats.total || 1)) * 100}%` }}
                                            ></div>
                                        </div>
                                        <div className="flex justify-between text-xs text-slate-400 font-mono">
                                            <span>Sent: {queueStats.sent}</span>
                                            <span>Pending: {queueStats.pending}</span>
                                            <span>Total: {queueStats.total}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );

            case 'analytics':
                return (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-2xl font-bold text-white">Performance Analytics</h3>
                                <p className="text-slate-400">Insights into agent interactions, costs, and user sentiment.</p>
                            </div>
                        </div>

                        {/* Top Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <StatCard title="Est. Cost" value={`$${stats.costs.total.toFixed(2)}`} icon={<DollarIcon />} color="emerald" trend="Month to Date" />
                            <StatCard title="Calls Handed Off" value={stats.callsTriggered} icon={<PhoneIcon />} color="purple" trend={`${(stats.callsTriggered / (stats.totalLogs || 1) * 100).toFixed(1)}% Rate`} />
                            <StatCard title="Sentiment Score" value={`${Math.round((stats.sentiment.positive / (stats.totalLogs || 1)) * 100)}%`} icon={<PieChartIcon />} color="blue" trend="Positive Ratio" />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Sentiment Breakdown */}
                            <div className="glass-panel p-6 rounded-2xl border border-white/5">
                                <h3 className="text-lg font-semibold text-white mb-6">User Sentiment Breakdown</h3>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm text-slate-400"><span>Positive</span> <span>{stats.sentiment.positive}</span></div>
                                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${(stats.sentiment.positive / stats.totalLogs) * 100}%` }}></div></div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm text-slate-400"><span>Neutral</span> <span>{stats.sentiment.neutral}</span></div>
                                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-blue-500" style={{ width: `${(stats.sentiment.neutral / stats.totalLogs) * 100}%` }}></div></div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm text-slate-400"><span>Negative / Frustrated</span> <span>{stats.sentiment.negative}</span></div>
                                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-red-500" style={{ width: `${(stats.sentiment.negative / stats.totalLogs) * 100}%` }}></div></div>
                                    </div>
                                </div>
                            </div>

                            {/* ROI / Value */}
                            <div className="glass-panel p-6 rounded-2xl border border-white/5 flex flex-col justify-center items-center text-center space-y-4">
                                <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                    <DollarIcon className="w-8 h-8 text-emerald-400" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold text-white">Estimated Savings</h3>
                                    <p className="text-slate-400 text-sm">vs Human Agent ($20/hr)</p>
                                </div>
                                <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                                    ${(stats.totalLogs * 0.50).toFixed(2)}
                                </div>
                                <p className="text-xs text-slate-500 max-w-xs">Calculated based on average time saved per automated interaction vs manual handling.</p>
                            </div>
                        </div>
                    </div>
                );

            case 'access_control':
                return (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-2xl font-bold text-white">Access Control</h3>
                                <p className="text-slate-400">Manage admins and team members who can chat freely with the AI.</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="glass-panel p-6 rounded-2xl">
                                <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                                    <ShieldCheckIcon className="w-5 h-5 text-purple-400" /> Add New Admin
                                </h3>
                                <div className="space-y-4">
                                    <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+1 (555) 000-0000" className="w-full glass-input px-4 py-3 rounded-xl text-sm placeholder-slate-600 font-mono" />
                                    <button onClick={addAdminNumber} className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-medium py-3 rounded-xl transition-all">Authorize User</button>
                                </div>
                            </div>
                            <div className="lg:col-span-2 glass-panel p-0 rounded-2xl overflow-hidden min-h-[500px] flex flex-col">
                                <div className="p-6 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
                                    <h3 className="text-lg font-semibold text-white">Authorized Users</h3>
                                    <span className="text-xs font-mono bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded border border-emerald-500/20">{whitelist.length} Active</span>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
                                    {whitelist.map(item => (
                                        <div key={item.id} className="group flex justify-between items-center p-4 rounded-xl hover:bg-white/5 transition-all">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-800 to-blue-900 border border-white/5 flex items-center justify-center text-white font-bold">
                                                    <ShieldCheckIcon className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="text-white font-medium flex items-center gap-2">
                                                        {item.name || 'Admin User'}
                                                        {item.role === 'admin' && <span className="bg-purple-500/20 text-purple-300 text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Admin</span>}
                                                    </p>
                                                    <p className="text-slate-500 text-sm font-mono">{item.phone_number}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <div className={`text-xs px-2 py-1 rounded-full border ${item.ai_status === 'active' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
                                                    {item.ai_status === 'active' ? 'AI Active' : 'Paused'}
                                                </div>
                                                <button onClick={() => deleteAdminNumber(item.id)} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-red-400 transition-colors">
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {whitelist.length === 0 && (
                                        <div className="text-center py-12 text-slate-500 text-sm">No authorized users found. Add one to get started.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'knowledge':
                return (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-2xl font-bold text-white">Knowledge Base</h3>
                                <p className="text-slate-400">Teach the AI about your business.</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="glass-panel p-8 rounded-2xl border border-blue-500/20 relative overflow-hidden h-fit">
                                <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-3">
                                    <BookIcon className="w-5 h-5 text-blue-400" /> Add New Knowledge
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs text-slate-400 mb-1 block uppercase font-bold">Paste Text</label>
                                        <textarea
                                            value={newDocContent}
                                            onChange={(e) => setNewDocContent(e.target.value)}
                                            placeholder="Paste your pricing, FAQ, or business policy here..."
                                            className="w-full h-32 glass-input px-4 py-3 rounded-xl text-sm placeholder-slate-600 font-mono focus:ring-2 focus:ring-blue-500/50 transition-all resize-none mb-2"
                                        />
                                        <button
                                            onClick={uploadDocument}
                                            disabled={isUploading || !newDocContent.trim()}
                                            className="w-full bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 font-medium py-2 rounded-lg transition-all text-xs border border-blue-600/30"
                                        >
                                            Add Text
                                        </button>
                                    </div>

                                    <div className="pt-4 border-t border-white/10">
                                        <label className="text-xs text-slate-400 mb-1 block uppercase font-bold">Or Train from URL</label>
                                        <div className="flex gap-2">
                                            <input
                                                value={trainUrl}
                                                onChange={(e) => setTrainUrl(e.target.value)}
                                                placeholder="https://example.com"
                                                className="flex-1 glass-input px-3 py-2 rounded-lg text-sm placeholder-slate-600"
                                            />
                                            <button
                                                onClick={trainFromUrl}
                                                disabled={isUploading || !trainUrl.trim()}
                                                className="bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 font-medium px-4 py-2 rounded-lg transition-all text-xs border border-purple-600/30"
                                            >
                                                {isUploading ? '...' : <GlobeIcon className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="lg:col-span-2 glass-panel p-0 rounded-2xl overflow-hidden min-h-[500px] flex flex-col">
                                <div className="p-6 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
                                    <h3 className="text-lg font-semibold text-white">Known Documents</h3>
                                    <span className="text-xs font-mono bg-blue-500/10 text-blue-400 px-2 py-1 rounded border border-blue-500/20">{documents.length} Docs</span>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
                                    {documents.map(doc => (
                                        <div key={doc.id} className="group p-4 rounded-xl hover:bg-white/5 transition-all border border-transparent hover:border-white/5 space-y-2">
                                            <p className="text-slate-300 text-sm line-clamp-2 font-light">{doc.content}</p>
                                            <span className="text-xs text-slate-500">{new Date(doc.created_at).toLocaleDateString()}</span>
                                        </div>
                                    ))}
                                    {documents.length === 0 && (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
                                            <BookIcon className="w-12 h-12 opacity-20" />
                                            <p>No knowledge added yet.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'whitelist':
                return (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-2xl font-bold text-white">Contact Management</h3>
                                <p className="text-slate-400">Manage your address book and authorized users.</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="glass-panel p-8 rounded-2xl border border-purple-500/20 relative overflow-hidden h-fit">
                                <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-3">
                                    <PlusIcon className="w-5 h-5 text-purple-400" /> Add New Contact
                                </h3>
                                <div className="space-y-4">
                                    <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+1 (555) 000-0000" className="w-full glass-input px-4 py-3 rounded-xl text-sm placeholder-slate-600 font-mono" />
                                    <button onClick={addNumber} className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-medium py-3 rounded-xl transition-all">Add Single Number</button>

                                    <div className="relative my-4">
                                        <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-white/10"></span></div>
                                        <div className="relative flex justify-center text-xs uppercase"><span className="bg-[#0a0a0c] px-2 text-slate-500">Or Bulk Upload</span></div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <label className="cursor-pointer bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 flex flex-col items-center gap-2 transition-all group">
                                            <input type="file" accept=".csv" className="hidden" onChange={(e) => handleFileUpload(e, 'csv')} />
                                            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:bg-emerald-500/30 transition-all">
                                                <span className="text-xs font-bold">CSV</span>
                                            </div>
                                            <span className="text-xs text-slate-400 group-hover:text-white">Upload CSV</span>
                                        </label>
                                        <label className="cursor-pointer bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 flex flex-col items-center gap-2 transition-all group">
                                            <input type="file" accept=".vcf,.vcard" className="hidden" onChange={(e) => handleFileUpload(e, 'vcard')} />
                                            <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center group-hover:bg-blue-500/30 transition-all">
                                                <UserIcon className="w-4 h-4" />
                                            </div>
                                            <span className="text-xs text-slate-400 group-hover:text-white">Upload vCard</span>
                                        </label>
                                    </div>
                                    {isImporting && <p className="text-xs text-center text-blue-400 animate-pulse mt-2">Importing contacts...</p>}
                                </div>
                            </div>
                            <div className="lg:col-span-2 glass-panel p-0 rounded-2xl overflow-hidden min-h-[500px] flex flex-col">
                                <div className="p-6 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
                                    <h3 className="text-lg font-semibold text-white">Contact Database</h3>
                                    <span className="text-xs font-mono bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded border border-emerald-500/20">
                                        {tabLoading['whitelist'] ? '...' : `${contacts.length} Active`}
                                    </span>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
                                    {(isLoading || tabLoading['whitelist']) ? (
                                        Array(6).fill(0).map((_, i) => (
                                            <div key={i} className="flex items-center gap-4 p-4 border border-white/5 rounded-xl">
                                                <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                                                <div className="flex-1 space-y-2">
                                                    <Skeleton className="w-32 h-4" />
                                                    <Skeleton className="w-48 h-3" />
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        contacts.map(item => (
                                            <div key={item.id} className="group flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 rounded-xl hover:bg-white/5 transition-all gap-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 border border-white/5 flex items-center justify-center text-slate-400 font-bold shrink-0">
                                                        {item.phone_number.slice(-2)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <p className="text-white font-mono text-lg truncate">{item.phone_number}</p>
                                                            {item.active_goal_description && (
                                                                <span className="flex items-center gap-1 text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 animate-pulse whitespace-nowrap">
                                                                    <TargetIcon className="w-2.5 h-2.5" /> {item.active_goal_type}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                                            <p className="text-[10px] text-slate-500">Added {new Date(item.created_at).toLocaleDateString()}</p>
                                                            {item.active_goal_description && (
                                                                <p className="text-[10px] text-blue-500/70 font-medium italic truncate max-w-[200px]">"{item.active_goal_description}"</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 ml-14 sm:ml-0">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedGoalPhone(item.phone_number);
                                                            setNewGoalDesc(item.active_goal_description || "");
                                                            setGoalModalOpen(true);
                                                        }}
                                                        className="p-2.5 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"
                                                        title="Set AI Goal"
                                                    >
                                                        <TargetIcon className="w-5 h-5" />
                                                    </button>
                                                    <button onClick={() => deleteNumber(item.id)} className="p-2.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"><TrashIcon className="w-5 h-5" /></button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                    {!isLoading && contacts.length === 0 && (
                                        <div className="text-center py-20 text-slate-500 italic">No contacts in database.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'logs':
                return (
                    <div className="space-y-6 animate-in fade-in duration-500 pb-20 lg:pb-0">
                        <div className="flex items-center justify-between">
                            <h3 className="text-2xl font-bold text-white">System Logs</h3>
                            <button onClick={() => hydrateTab('logs')} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-sm transition-all flex items-center gap-2">
                                {tabLoading['logs'] ? 'Refreshing...' : <><ActivityIcon className="w-4 h-4" /> Refresh Full Logs</>}
                            </button>
                        </div>
                        <div className="glass-panel rounded-2xl p-1 overflow-hidden min-h-[500px] flex flex-col border border-white/5">
                            {/* Table Header (Desktop only) */}
                            <div className="hidden lg:grid grid-cols-12 gap-4 p-6 border-b border-white/5 bg-white/[0.02] text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                <div className="col-span-2">Time</div>
                                <div className="col-span-2">Direction</div>
                                <div className="col-span-2">Agent</div>
                                <div className="col-span-6">Message Content</div>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 lg:p-0">
                                {(isLoading || tabLoading['logs']) ? (
                                    Array(8).fill(0).map((_, i) => (
                                        <div key={i} className="p-4 space-y-3 lg:space-y-0 lg:grid lg:grid-cols-12 lg:gap-4 border-b border-white/5">
                                            <Skeleton className="w-24 h-4 lg:col-span-2" />
                                            <Skeleton className="w-16 h-4 lg:col-span-2" />
                                            <Skeleton className="w-20 h-4 lg:col-span-2" />
                                            <Skeleton className="w-full h-4 lg:col-span-6" />
                                        </div>
                                    ))
                                ) : (
                                    logs.map((log) => (
                                        <div key={log.id} className="flex flex-col lg:grid lg:grid-cols-12 gap-3 lg:gap-4 p-4 hover:bg-white/[0.02] border-b border-white/5 text-sm transition-colors items-start lg:items-center group">
                                            {/* Mobile: Time & Direction row */}
                                            <div className="flex items-center justify-between w-full lg:contents">
                                                <div className="lg:col-span-2 font-mono text-slate-500 text-[10px] lg:text-xs">
                                                    {new Date(log.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                                                </div>
                                                <div className="lg:col-span-2">
                                                    <span className={`text-[10px] lg:text-xs font-bold px-2 py-0.5 lg:py-1 rounded-md border inline-flex items-center gap-1 ${log.direction === 'inbound' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
                                                        {log.direction === 'inbound' ? <ArrowDownIcon className="w-2.5 h-2.5" /> : <ArrowUpIcon className="w-2.5 h-2.5" />}
                                                        {log.direction === 'inbound' ? 'IN' : 'OUT'}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="lg:col-span-2 text-slate-400 font-mono text-[10px] uppercase tracking-wide">
                                                <span className="lg:hidden text-slate-600 mr-2">Agent:</span>
                                                {log.agent_used || 'system'}
                                            </div>

                                            <div className="lg:col-span-6 text-slate-300 font-light leading-relaxed">
                                                {log.content}
                                            </div>
                                        </div>
                                    ))
                                )}
                                {!isLoading && logs.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-20 text-slate-500 italic">No logs found for this period.</div>
                                )}
                            </div>
                        </div>
                    </div>
                );

            case 'settings':
                return (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        <h3 className="text-2xl font-bold text-white">System Settings</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Webhook Configuration */}
                            <div className="glass-panel p-6 rounded-2xl border border-white/5">
                                <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
                                    <GlobeIcon className="w-5 h-5 text-blue-400" /> Webhook Integrations
                                </h4>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs text-slate-400 mb-1 block uppercase font-bold">Incoming Webhook (Copy to GHL)</label>
                                        <div className="flex gap-2">
                                            <div className="flex-1 glass-input px-3 py-2 rounded-lg text-sm text-slate-300 font-mono truncate bg-black/40 border border-white/10">
                                                {typeof window !== 'undefined' ? `${window.location.origin}/api/webhook/ghl/incoming` : '...'}
                                            </div>
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(`${window.location.origin}/api/webhook/ghl/incoming`);
                                                    alert("Copied Incoming Webhook URL!");
                                                }}
                                                className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 font-medium px-4 py-2 rounded-lg transition-all text-sm border border-blue-600/30 whitespace-nowrap"
                                            >
                                                Copy
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-slate-500 mt-1">Paste this into your GoHighLevel Workflow (Webhook Action) to send inbound messages here.</p>
                                    </div>

                                    <div className="pt-4 border-t border-white/5">
                                        <label className="text-xs text-slate-400 mb-2 block uppercase font-bold">Required GHL JSON Format</label>
                                        <div className="bg-black/50 p-4 rounded-lg font-mono text-xs text-emerald-400 border border-white/10 overflow-x-auto relative group">
                                            <pre>{`{
  "From": "{{contact.phone}}",
  "Body": " {{message.body}}",
  "contact_name": "{{contact.name}}"
}`}</pre>
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(`{\n  "From": "{{contact.phone}}",\n  "Body": " {{message.body}}",\n  "contact_name": "{{contact.name}}"\n}`);
                                                    alert("Copied JSON Payload!");
                                                }}
                                                className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 text-white p-1 rounded transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                Copy
                                            </button>
                                        </div>
                                        <div className="mt-3 flex gap-2">
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        const res = await fetch('/api/webhook/ghl/incoming', {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({
                                                                From: "+15550000000",
                                                                Body: "Test incoming message from Dashboard",
                                                                contact_name: "Test User"
                                                            })
                                                        });
                                                        const data = await res.json();
                                                        if (res.ok) alert("Simulated Incoming Message! Check Chat/Logs.");
                                                        else alert("Error: " + JSON.stringify(data));
                                                        fetchData(); // Refresh logs
                                                    } catch (e) { alert("Failed to fetch"); }
                                                }}
                                                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-lg border border-white/5 transition-all"
                                            >
                                                Test Incoming
                                            </button>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-white/5">
                                        <label className="text-xs text-slate-400 mb-1 block uppercase font-bold">Outgoing Webhook (From App to GHL)</label>
                                        <div className="flex gap-2">
                                            <input
                                                value={ghlWebhook}
                                                onChange={(e) => setGhlWebhook(e.target.value)}
                                                placeholder="https://services.leadconnectorhq.com/hooks/..."
                                                className="flex-1 glass-input px-3 py-2 rounded-lg text-sm placeholder-slate-600 font-mono bg-black/40 border border-white/10"
                                            />
                                        </div>
                                        <div className="flex justify-end mt-2 gap-2">
                                            <button
                                                onClick={async () => {
                                                    if (!ghlWebhook) return alert("Enter a URL first");
                                                    try {
                                                        const res = await fetch('/api/webhook/ghl/outgoing', {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({
                                                                contact: { name: "Test User", phone: "+15550000000", email: "test@example.com" },
                                                                message: "Test outgoing message",
                                                                manualUrl: ghlWebhook // Force use of this URL
                                                            })
                                                        });
                                                        const data = await res.json();
                                                        if (res.ok) alert(`Success! Sent test event to ${ghlWebhook}`);
                                                        else alert("Error: " + data.error);
                                                    } catch (e) { alert("Failed to send test"); }
                                                }}
                                                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-lg border border-white/5 transition-all"
                                            >
                                                Test Outgoing
                                            </button>
                                            <button
                                                onClick={saveBranding}
                                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2 rounded-lg transition-all text-xs shadow-lg shadow-emerald-900/20"
                                            >
                                                Save Settings
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-slate-500 mt-1">Found in your GHL Automation Trigger (Incoming Webhook).</p>
                                    </div>
                                </div>
                            </div>

                            <div className="glass-panel p-6 rounded-2xl">
                                <h4 className="text-white font-semibold mb-4">Data Management</h4>
                                <div className="flex gap-4">
                                    <button onClick={exportLogs} className="flex-1 bg-white/5 hover:bg-white/10 text-white py-2 rounded-lg transition-colors border border-white/10">Export CSV</button>
                                    <button onClick={clearHistory} className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 py-2 rounded-lg transition-colors border border-red-500/20">Clear History</button>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'overview':
            default:
                return (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <StatCard loading={isLoading} title="Total Leads" value={stats.totalWhitelisted} icon={<UsersIcon />} color="purple" trend="+12% this month" />
                            <StatCard loading={isLoading} title="Interactions" value={stats.totalLogs} icon={<ActivityIcon />} color="blue" trend="+5.2k total" />
                            <StatCard loading={isLoading} title="Daily Traffic" value={stats.interactionsToday} icon={<PieChartIcon />} color="emerald" trend="Active now" />
                            <StatCard loading={isLoading} title="System Health" value={healthStatus === 'healthy' ? 'Optimal' : (healthStatus === 'checking' ? 'Checking...' : 'Issues Detected')} icon={<ShieldCheckIcon />} color={healthStatus === 'healthy' ? 'emerald' : 'blue'} />
                        </div>
                        <div className="glass-panel rounded-2xl p-1 overflow-hidden">
                            <div className="p-6 border-b border-white/5 bg-white/[0.02]">
                                <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
                            </div>
                            <div className="max-h-[500px] overflow-y-auto custom-scrollbar p-5 space-y-4">
                                {isLoading ? (
                                    Array(5).fill(0).map((_, i) => (
                                        <div key={i} className="flex gap-4 p-3">
                                            <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                                            <div className="flex-1 space-y-2">
                                                <Skeleton className="w-full h-4" />
                                                <Skeleton className="w-3/4 h-3" />
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    logs.slice(0, 10).map((log: any, i) => (
                                        <div key={log.id} className="relative pl-6 pb-2 group">
                                            {i !== logs.slice(0, 10).length - 1 && <div className="absolute left-[11px] top-8 bottom-0 w-px bg-slate-800 group-hover:bg-slate-700 transition-colors"></div>}
                                            <div className="flex items-start justify-between group-hover:bg-white/5 p-3 -ml-3 rounded-xl transition-colors">
                                                <div className="flex gap-4">
                                                    <div className={`relative z-10 mt-1 h-6 w-6 rounded-full border-2 border-[#0a0a0c] flex items-center justify-center shrink-0 ${log.direction === 'inbound' ? 'bg-blue-500' : 'bg-emerald-500'}`}>
                                                        {log.direction === 'inbound' ? <ArrowDownIcon className="w-3 h-3 text-white" /> : <ArrowUpIcon className="w-3 h-3 text-white" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm text-slate-300 leading-relaxed font-light line-clamp-2 md:line-clamp-1">{log.content}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-[10px] text-slate-500 font-mono">{log.agent_used}</span>
                                                            {log.sentiment && (
                                                                <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border ${log.sentiment === 'positive' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                                                                    log.sentiment === 'negative' || log.sentiment === 'frustrated' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                                                                        'bg-slate-500/10 border-slate-500/20 text-slate-400'
                                                                    }`}>
                                                                    {log.sentiment}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <span className="text-[9px] text-slate-600 font-mono whitespace-nowrap ml-2">{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0c] text-slate-200 font-sans selection:bg-purple-500/30">
            {/* Mobile Header */}
            <MobileHeader
                onMenuClick={() => setSidebarOpen(!isSidebarOpen)}
                isOpen={isSidebarOpen}
                brandLogo={brandLogo}
            />

            {/* Sidebar Overlay (Mobile) */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] lg:hidden animate-in fade-in duration-300"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`fixed top-0 left-0 bottom-0 z-[80] w-72 glass-panel border-r border-white/5 transition-all duration-500 ease-out transform
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
                <div className="h-full flex flex-col p-6">
                    <div className="flex items-center gap-3 mb-10 px-2 shrink-0">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/20 group">
                            {brandLogo ? <img src={brandLogo} alt="Logo" className="w-8 h-8 object-contain" /> : <ShieldCheckIcon className="text-white w-6 h-6 transform group-hover:rotate-12 transition-transform" />}
                        </div>
                        <div className={`${!isSidebarOpen && 'lg:hidden'} transition-all duration-300`}>
                            <h1 className="text-xl font-bold text-white tracking-tight">AI Agent</h1>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none">Powered by Hive</p>
                        </div>
                    </div>

                    <nav className="flex-1 space-y-2 relative overflow-y-auto custom-scrollbar pr-2 -mr-2">
                        <NavButton active={activeTab === 'overview'} onClick={() => { setActiveTab('overview'); setSidebarOpen(false); }} icon={<HomeIcon />} label="Overview" expanded={true} />
                        <NavButton active={activeTab === 'campaigns'} onClick={() => { setActiveTab('campaigns'); setSidebarOpen(false); }} icon={<MegaphoneIcon />} label="Campaigns" expanded={true} />
                        <NavButton active={activeTab === 'whitelist'} onClick={() => { setActiveTab('whitelist'); setSidebarOpen(false); }} icon={<UsersIcon />} label="Contacts" expanded={true} />
                        <NavButton active={activeTab === 'logs'} onClick={() => { setActiveTab('logs'); setSidebarOpen(false); }} icon={<ActivityIcon />} label="Conversations" expanded={true} />
                        <NavButton active={activeTab === 'knowledge'} onClick={() => { setActiveTab('knowledge'); setSidebarOpen(false); }} icon={<BookIcon />} label="Knowledge" expanded={true} />
                        <NavButton active={activeTab === 'access_control'} onClick={() => { setActiveTab('access_control'); setSidebarOpen(false); }} icon={<ShieldCheckIcon />} label="Admins" expanded={true} />
                        <NavButton active={activeTab === 'headhunter'} onClick={() => { setActiveTab('headhunter'); setSidebarOpen(false); }} icon={<GlobeIcon />} label="Headhunter" expanded={true} />
                        <NavButton active={activeTab === 'settings'} onClick={() => { setActiveTab('settings'); setSidebarOpen(false); }} icon={<SettingsIcon />} label="Settings" expanded={true} />

                        {/* Org Switcher (Restored) */}
                        <div className="pt-4 mt-4 border-t border-white/5">
                            <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block px-2">Organizations</label>
                            <div className="space-y-1">
                                {orgs.map(org => (
                                    <button
                                        key={org.id}
                                        onClick={() => setActiveOrg(org)}
                                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${activeOrg?.id === org.id
                                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                            : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'
                                            }`}
                                    >
                                        <div className={`w-1.5 h-1.5 rounded-full ${activeOrg?.id === org.id ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-slate-700'}`} />
                                        <span className="text-xs font-medium truncate">{org.name}</span>
                                    </button>
                                ))}
                                <button
                                    onClick={() => {
                                        const name = prompt("Org Name:");
                                        if (name) { setNewOrgName(name); createOrg(); }
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all text-xs"
                                >
                                    <PlusIcon size={14} /> New Org
                                </button>
                            </div>
                        </div>

                        {/* Brand Settings (Restored) */}
                        <div className="pt-4 mt-2">
                            <details className="text-[10px] group">
                                <summary className="cursor-pointer text-slate-500 hover:text-slate-300 font-bold uppercase transition-all flex items-center gap-2 px-2">
                                    <SparklesIcon size={12} /> Branding Settings
                                </summary>
                                <div className="mt-3 p-3 bg-white/[0.03] rounded-xl border border-white/5 space-y-3">
                                    <div>
                                        <label className="text-[9px] text-slate-500 mb-1 block">Brand Color</label>
                                        <div className="flex gap-2">
                                            <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="w-8 h-8 rounded-lg overflow-hidden p-0 border-0 bg-transparent cursor-pointer" />
                                            <input value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="flex-1 bg-black/20 border border-white/10 rounded-lg px-2 text-[10px] text-white" />
                                        </div>
                                    </div>
                                    <button onClick={saveBranding} className="w-full bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-600/30 py-1.5 rounded-lg text-[10px] font-bold transition-all">Apply Branding</button>
                                </div>
                            </details>
                        </div>
                    </nav>

                    <div className="pt-6 border-t border-white/5 shrink-0">
                        <div className="p-3 bg-white/[0.03] rounded-2xl border border-white/5 space-y-3">
                            <div className="flex items-center gap-3 px-1">
                                <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-xs font-bold text-slate-400">
                                    H
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-white truncate">Harry Castaner</p>
                                    <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" /> Active Admin
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => window.location.href = '/api/auth/signout'} className="w-full h-10 flex items-center justify-center gap-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all text-xs font-medium">
                                <LogoutIcon className="w-4 h-4" /> Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className={`transition-all duration-500 pt-[72px] lg:pt-0 ${isSidebarOpen ? 'lg:pl-72' : 'lg:pl-72'}`}>
                <div className="max-w-7xl mx-auto p-4 md:p-8 lg:p-10">
                    {renderContent()}
                </div>
            </main>
            {/* Goal Management Modal */}
            {goalModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="glass-panel w-full max-w-md p-8 rounded-3xl border border-blue-500/30 shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center">
                                <TargetIcon className="w-6 h-6 text-blue-400" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">Set AI Goal</h3>
                                <p className="text-xs text-slate-400">Targeting: {selectedGoalPhone}</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-1.5 block">Goal Category</label>
                                <select
                                    value={newGoalType}
                                    onChange={(e) => setNewGoalType(e.target.value)}
                                    className="w-full glass-input px-4 py-3 rounded-xl text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                                >
                                    <option value="qualification">Lead Qualification</option>
                                    <option value="book_call">Booking / Scheduling</option>
                                    <option value="collection">Info Collection</option>
                                    <option value="support">Customer Support</option>
                                    <option value="custom">Custom Goal</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-1.5 block">Specific Instructions / Goal description</label>
                                <textarea
                                    value={newGoalDesc}
                                    onChange={(e) => setNewGoalDesc(e.target.value)}
                                    placeholder="e.g. Find out if they own a home and want a quote..."
                                    className="w-full h-32 glass-input px-4 py-3 rounded-xl text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500/50 transition-all resize-none"
                                />
                            </div>

                            <button
                                onClick={handleSetGoal}
                                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 group"
                            >
                                Activate Goal <SendIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </button>

                            <button
                                onClick={() => setGoalModalOpen(false)}
                                className="w-full py-2 text-slate-500 hover:text-slate-300 transition-colors text-sm font-medium"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
