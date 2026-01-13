import Link from 'next/link';

export default function Home() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center relative overflow-hidden">
            {/* Background Blobs */}
            <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
            <div className="absolute top-0 -right-4 w-72 h-72 bg-sky-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
            <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>

            <div className="glass-panel p-12 rounded-2xl flex flex-col items-center max-w-2xl w-full mx-4 z-10 border border-slate-700">
                <h1 className="text-5xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 text-center text-glow">
                    AI Texting Agent
                </h1>
                <p className="text-lg text-slate-300 mb-10 text-center">
                    Next-generation autonomous communication platform.
                </p>

                <div className="flex gap-4">
                    <Link
                        href="/auth/signin"
                        className="px-8 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 transition-colors font-semibold text-white shadow-lg"
                    >
                        Sign In
                    </Link>
                    <Link
                        href="/dashboard"
                        className="px-8 py-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors font-semibold text-white border border-white/10 backdrop-blur-sm"
                    >
                        Dashboard
                    </Link>
                </div>
            </div>
        </main>
    );
}
