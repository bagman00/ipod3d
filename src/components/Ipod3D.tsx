'use client';

import React, { useState, useRef, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, OrbitControls, Environment, ContactShadows, Html } from '@react-three/drei';
import YouTube from 'react-youtube';
import { useMobile } from '../hooks/use-mobile';
import { Play, Pause, SkipBack, SkipForward, Rewind, FastForward, Repeat, Search, Battery, Home, Volume2, VolumeX, ListMusic } from 'lucide-react';
import { searchYouTube, YouTubeVideo } from '../lib/youtube-search';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchPlaylistItems, fetchVideoDetails } from '../lib/youtube-api';

// --- 3D Model ---
function Model() {
    const { scene } = useGLTF('/ipod_classic.glb');
    return (
        <group>
            <primitive object={scene} scale={1} />
        </group>
    );
}

// --- Screen Overlay (mounted inside 3D canvas) ---
function ScreenOverlay({
    videoId,
    title,
    channelName,
    index,
    total,
    onPlayerReady,
    onStateChange,
    progress,
    currentTime,
    duration,
    isPaused,
    onLoad,
    onGoHome,
    showHome,
    isLooping,
    onToggleLoop,
}: {
    videoId: string | null;
    title?: string;
    channelName?: string;
    index: number;
    total: number;
    onPlayerReady: (player: any) => void;
    onStateChange: (event: any) => void;
    progress: number;
    currentTime: number;
    duration: number;
    isPaused: boolean;
    onLoad: () => void;
    onGoHome: () => void;
    showHome: boolean;
    isLooping: boolean;
    onToggleLoop: () => void;
}) {
    const progressBarRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<any>(null);

    useEffect(() => { onLoad(); }, []);

    const formatTime = (seconds: number) => {
        const m = Math.floor(Math.abs(seconds) / 60);
        const s = Math.floor(Math.abs(seconds) % 60);
        return `${seconds < 0 ? '-' : ''}${m}:${s.toString().padStart(2, '0')}`;
    };

    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!progressBarRef.current || !playerRef.current || !duration) return;
        const rect = progressBarRef.current.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        playerRef.current.seekTo(percent * duration, true);
    };

    const handleInternalPlayerReady = (event: any) => {
        playerRef.current = event.target;
        onPlayerReady(event.target);
    };

    // parse title and artist
    let displayTitle = title || "No Title";
    let displayArtist = channelName || "YouTube";
    if (title) {
        const parts = title.split(/[-–|]/);
        if (parts.length >= 2) {
            displayArtist = parts[0].trim();
            displayTitle = parts.slice(1).join('-').trim();
        }
    }

    const showMenu = !videoId || showHome;

    return (
        <Html
            transform
            occlude="raycast"
            zIndexRange={[100, 0]}
            position={[0.015, 0.05, 0.00]}
            rotation={[-0.10, 1.57, 0.10]}
            scale={0.011}
            style={{ width: '320px', height: '240px', pointerEvents: 'none' }}
        >
            <div className="w-full h-full bg-white border-2 border-black rounded-[4px] relative flex font-sans overflow-hidden box-border shadow-inner pointer-events-auto">

                {/* Hidden YouTube Player */}
                {videoId && (
                    <div className="absolute top-0 left-0 w-1 h-1 opacity-0 pointer-events-none overflow-hidden z-0">
                        <YouTube
                            key={videoId}
                            videoId={videoId}
                            onReady={handleInternalPlayerReady}
                            onStateChange={onStateChange}
                            opts={{
                                width: '100%',
                                height: '100%',
                                playerVars: {
                                    autoplay: 1,
                                    controls: 0,
                                    fs: 0,
                                    modestbranding: 1,
                                    rel: 0,
                                    disablekb: 1,
                                    iv_load_policy: 3
                                },
                            }}
                        />
                    </div>
                )}

                {showMenu ? (
                    // --- MENU VIEW ---
                    <div className="w-full h-full flex font-sans">
                        <div className="w-1/2 h-full bg-white flex flex-col border-r border-[#e0e0e0]">
                            <div className="h-6 bg-gradient-to-b from-[#5c9ae6] to-[#407ad6] flex items-center justify-center shadow-sm shrink-0 border-b border-[#2a5caa]">
                                <span className="text-[12px] font-bold text-white">iPod</span>
                            </div>
                            <div className="flex-1 flex flex-col py-2 px-2">
                                <p className="text-[11px] font-semibold text-black text-center mb-2">
                                    What do you want to listen to?
                                </p>
                                <p className="text-[10px] text-gray-500 text-center">
                                    Search or paste a YouTube link above
                                </p>
                            </div>
                        </div>
                        <div className="w-1/2 h-full bg-[#f2f2f2] flex items-center justify-center">
                            <div className="relative w-20 h-20 opacity-10">
                                <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-black">
                                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                                </svg>
                            </div>
                        </div>
                    </div>
                ) : (
                    // --- NOW PLAYING VIEW ---
                    <div className="w-full h-full flex flex-col relative z-10">
                        {/* Header */}
                        <div className="h-6 bg-gradient-to-b from-[#fdffff] to-[#cbe9fe] flex items-center px-1 shadow-sm shrink-0 border-b border-[#95aec5] relative">
                            <button
                                onClick={(e) => { e.stopPropagation(); onGoHome(); }}
                                className="flex items-center justify-center bg-white/50 border border-white/60 p-0.5 rounded shadow-sm hover:bg-white/80 active:scale-95"
                            >
                                <Home size={12} fill="#3b82f6" className="text-[#2563eb]" />
                            </button>
                            <div className="absolute left-1/2 -translate-x-1/2 text-[11px] font-semibold text-black">
                                Now Playing
                            </div>
                            <div className="ml-auto">
                                <Battery size={16} fill="#4ade80" className="text-gray-600" />
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 flex min-h-0 bg-white">
                            {/* Album Art */}
                            <div className="w-[140px] h-full bg-white relative shrink-0 border-r border-[#d1d5db] flex items-center justify-center overflow-hidden">
                                <div
                                    className="w-full flex flex-col"
                                    style={{
                                        transform: 'perspective(600px) rotateY(25deg) scale(0.85) translateX(8px) translateY(24px)',
                                        transformStyle: 'preserve-3d'
                                    }}
                                >
                                    <div className="w-full aspect-square relative z-10 shadow-xl">
                                        <img
                                            src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                                            alt="Album Art"
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div className="w-full h-16 relative overflow-hidden mt-1">
                                        <img
                                            src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                                            alt="Reflection"
                                            className="w-full aspect-square object-cover scale-y-[-1] opacity-50 blur-[1px]"
                                            style={{ maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 20%, rgba(0,0,0,0) 100%)' }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Info */}
                            <div className="flex-1 p-3 flex flex-col justify-center min-w-0 bg-[#f8f9fa]">
                                <h1 className="text-sm font-bold text-[#1a1a1a] leading-tight line-clamp-3 mb-1">
                                    {displayTitle}
                                </h1>
                                <h2 className="text-[11px] font-semibold text-[#555] truncate">
                                    {displayArtist}
                                </h2>
                                <div className="mt-2 flex items-center justify-between">
                                    <div className="text-[9px] text-[#666]">
                                        {index} of {total}
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onToggleLoop(); }}
                                        className="p-1.5 hover:scale-110 active:scale-95 transition-transform"
                                    >
                                        <Repeat
                                            size={18}
                                            className={isLooping ? "text-blue-500" : "text-[#888]"}
                                        />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="h-8 bg-[#f8f9fa] px-3 flex flex-col justify-center shrink-0 border-t border-[#e5e7eb]">
                            <div
                                ref={progressBarRef}
                                onClick={handleSeek}
                                className="w-full h-1.5 bg-[#d1d5db] rounded-sm overflow-hidden cursor-pointer"
                            >
                                <div
                                    className="h-full bg-gradient-to-r from-[#6ba4ef] to-[#407ad6]"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-[8px] mt-0.5 font-semibold text-[#666]">
                                <span>{formatTime(currentTime)}</span>
                                <span>-{formatTime(Math.max(0, duration - currentTime))}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Html>
    );
}

// --- Main Ipod3D Component ---
export default function Ipod3D() {
    const isMobile = useMobile();
    const [isModelLoaded, setIsModelLoaded] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [videoUrl, setVideoUrl] = useState('');
    const [queue, setQueue] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [isPlaying, setIsPlaying] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);
    const [showHome, setShowHome] = useState(false);
    const [isLooping, setIsLooping] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [volume, setVolume] = useState(100);
    const [isMuted, setIsMuted] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<YouTubeVideo[]>([]);
    const [searchError, setSearchError] = useState<string | null>(null);

    const playerRef = useRef<any>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const currentVideoId = currentIndex >= 0 && queue[currentIndex]
        ? queue[currentIndex].id
        : null;

    useEffect(() => { setIsLooping(false); }, [currentVideoId]);

    // progress tracker
    useEffect(() => {
        const interval = setInterval(() => {
            if (playerRef.current) {
                const current = playerRef.current.getCurrentTime?.();
                const dur = playerRef.current.getDuration?.();
                if (dur > 0) {
                    setProgress((current / dur) * 100);
                    setDuration(dur);
                    setCurrentTime(current);
                    const state = playerRef.current.getPlayerState?.();
                    setIsPaused(state !== 1 && state !== 3);
                }
            }
        }, 500);
        return () => clearInterval(interval);
    }, []);

    const handlePlayerReady = (player: any) => {
        playerRef.current = player;
        player.playVideo();
    };

    const handleStateChange = (event: any) => {
        if (event.data === 1) setIsPlaying(true);
        if (event.data === 2) setIsPlaying(false);
        if (event.data === 0) {
            setIsPlaying(false);
            if (isLooping) {
                event.target.seekTo(0);
                event.target.playVideo();
                return;
            }
            if (currentIndex < queue.length - 1) playNext();
        }
    };

    const handleConfirm = async () => {
        if (!videoUrl.trim()) return;
        setIsSearching(true);
        setSearchError(null);
        const { items, error } = await searchYouTube(videoUrl);
        if (error) { setSearchError(error); setIsSearching(false); return; }
        if (!items || items.length === 0) { setSearchError("No results found"); setIsSearching(false); return; }
        setSearchResults(items);
        setIsSearching(false);
    };

    const playVideoFromUrl = async (url: string, channelName?: string, videoTitle?: string) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const listRegExp = /[?&]list=([^#&?]+)/;
        const match = url.match(regExp);
        const listMatch = url.match(listRegExp);

        if (listMatch && listMatch[1]) {
            const playlistId = listMatch[1];
            const playlistItems = await fetchPlaylistItems(playlistId);
            if (playlistItems.items.length > 0) {
                const newItems = playlistItems.items.map((item: any) => ({
                    id: item.id, url: item.url, title: item.title,
                    channel: item.channel, fromPlaylist: true,
                    playlistId, playlistTitle: playlistItems.title
                }));
                setQueue(newItems);
                let jumpIndex = 0;
                if (match && match[2] && match[2].length === 11) {
                    const idx = newItems.findIndex((h: any) => h.id === match[2]);
                    if (idx !== -1) jumpIndex = idx;
                }
                setCurrentIndex(jumpIndex);
                setHasStarted(true);
                setVideoUrl('');
            }
            return;
        }

        if (match && match[2].length === 11) {
            const newId = match[2];
            let title = videoTitle || 'Loading title...';
            let channel = channelName;
            if (!videoTitle || !channelName) {
                try {
                    const details = await fetchVideoDetails(newId);
                    if (details) { title = details.title; channel = details.channel; }
                } catch (err) { console.error(err); }
            }
            const newItem = { id: newId, url, title, channel, fromPlaylist: false };
            setQueue(prev => {
                const filtered = prev.filter(p => p.id !== newId);
                const next = [...filtered, newItem];
                setCurrentIndex(next.length - 1);
                return next;
            });
            setVideoUrl('');
            setHasStarted(true);
            setShowHome(false);
        }
    };

    const togglePlayPause = () => {
        if (!playerRef.current) return;
        if (isPlaying) playerRef.current.pauseVideo();
        else playerRef.current.playVideo();
    };

    const handleSeek = (seconds: number) => {
        if (!playerRef.current) return;
        playerRef.current.seekTo(playerRef.current.getCurrentTime() + seconds, true);
    };

    const playNext = () => {
        if (currentIndex < queue.length - 1) setCurrentIndex(prev => prev + 1);
    };

    const playPrev = () => {
        if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseInt(e.target.value);
        setVolume(newVolume);
        if (playerRef.current) {
            playerRef.current.setVolume(newVolume);
            if (newVolume > 0 && isMuted) { playerRef.current.unMute(); setIsMuted(false); }
            if (newVolume === 0) { playerRef.current.mute(); setIsMuted(true); }
        }
    };

    const toggleMute = () => {
        if (!playerRef.current) return;
        if (isMuted) { playerRef.current.unMute(); setIsMuted(false); }
        else { playerRef.current.mute(); setIsMuted(true); }
    };

    const handleGoHome = () => {
        if (currentVideoId) setShowHome(true);
        else { setCurrentIndex(-1); setIsPlaying(false); }
    };

    return (
        <>
            {/* Full Screen Loader */}
            <AnimatePresence>
                {!isModelLoaded && (
                    <motion.div
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.8 }}
                        className="fixed inset-0 z-[10000] bg-[#e8e8e8] flex flex-col items-center justify-center"
                    >
                        <p className="text-stone-500 font-medium text-sm tracking-[0.2em] uppercase animate-pulse">
                            Loading Experience
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Search Bar */}
            {hasStarted && (
                <div className={`fixed top-6 z-[200] flex flex-col items-center ${isMobile ? "left-4 right-4" : "right-6 w-[300px]"}`}>
                    <div className={`w-full relative backdrop-blur-xl bg-white/70 rounded-2xl border border-white/50 shadow-lg transition-all duration-300 ${isFocused ? "shadow-xl bg-white/90 scale-[1.02]" : ""}`}>
                        <div className="relative flex items-center">
                            <div className="pl-5 pr-2">
                                <Search className={`w-4 h-4 ${isFocused ? "text-stone-600" : "text-stone-400"}`} />
                            </div>
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Search YouTube"
                                value={videoUrl}
                                onChange={(e) => {
                                    setVideoUrl(e.target.value);
                                    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
                                    if (e.target.value.trim().length > 2) {
                                        searchTimeoutRef.current = setTimeout(() => handleConfirm(), 500);
                                    } else if (e.target.value.trim().length === 0) {
                                        setSearchResults([]);
                                    }
                                }}
                                onFocus={() => setIsFocused(true)}
                                onBlur={() => setTimeout(() => setIsFocused(false), 200)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
                                className="flex-1 bg-transparent py-2.5 pr-4 text-stone-800 text-[13px] font-light placeholder:text-stone-400 focus:outline-none"
                            />
                            <div className="pr-2">
                                <button
                                    onClick={handleConfirm}
                                    disabled={!videoUrl.trim() ? true : false}
                                    className={`w-8 h-8 rounded-xl bg-gradient-to-b from-stone-700 to-stone-900 flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${videoUrl.trim() ? "opacity-100" : "opacity-40"}`}
                                >
                                    {isSearching
                                        ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        : <Search className="w-4 h-4 text-white" />
                                    }
                                </button>
                            </div>
                        </div>

                        {/* Search Results */}
                        {searchResults.length > 0 && isFocused && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 overflow-hidden p-1 z-[300]">
                                {searchResults.map((result) => (
                                    <button
                                        key={result.id}
                                        onClick={() => {
                                            playVideoFromUrl(`https://www.youtube.com/watch?v=${result.id}`, result.channel, result.title);
                                            setSearchResults([]);
                                        }}
                                        className="w-full flex items-center gap-2 p-1.5 hover:bg-gradient-to-b hover:from-[#5c9ae6] hover:to-[#407ad6] rounded-lg transition-all text-left group"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-xs font-medium text-gray-800 truncate group-hover:text-white">{result.title}</h4>
                                            <p className="text-[10px] text-gray-500 truncate group-hover:text-white/90">{result.channel}</p>
                                        </div>
                                        <Play size={12} className="text-blue-500 opacity-0 group-hover:opacity-100 group-hover:text-white mr-2" fill="currentColor" />
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Error */}
                        {searchError && (
                            <div className="absolute top-full left-0 right-0 mt-2 p-2 bg-red-50/90 rounded-xl border border-red-200 text-red-600 text-xs text-center z-[290]">
                                {searchError}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Player Controls Sidebar */}
            {hasStarted && (
                <div className={`fixed z-50 flex flex-col gap-4 transition-all duration-300 ${isMobile ? "bottom-20 right-5 w-64" : "top-8 left-8 w-64"}`}>
                    <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-white/20">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Player</span>
                        {currentVideoId && queue[currentIndex] && (
                            <div className="mb-3 pb-3 border-b border-gray-100">
                                <p className="text-xs font-semibold text-gray-800 truncate">{queue[currentIndex].title}</p>
                                <p className="text-[10px] text-gray-500 truncate">{queue[currentIndex].channel || "YouTube"}</p>
                            </div>
                        )}                        <div className="flex items-center justify-between gap-2">
                            <button onClick={playPrev} disabled={currentIndex <= 0 ? true : false} className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-30">
                                <SkipBack size={20} fill="currentColor" />
                            </button>
                            <button onClick={() => handleSeek(-5)} className="p-2 rounded-full hover:bg-gray-100">
                                <Rewind size={20} fill="currentColor" />
                            </button>
                            <button onClick={togglePlayPause} className="p-3 bg-black text-white rounded-full hover:bg-gray-800 active:scale-95 shadow-lg">
                                {isPlaying
                                    ? <Pause size={24} fill="white" />
                                    : <Play size={24} fill="white" />
                                }
                            </button>
                            <button onClick={() => handleSeek(5)} className="p-2 rounded-full hover:bg-gray-100">
                                <FastForward size={20} fill="currentColor" />
                            </button>
                            <button onClick={playNext} disabled={currentIndex >= queue.length - 1 ? true : false} className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-30">
                                <SkipForward size={20} fill="currentColor" />
                            </button>
                        </div>
                        <div className="flex items-center gap-2 mt-2 px-1">
                            <button onClick={toggleMute} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-600">
                                {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                            </button>
                            <input
                                type="range" min="0" max="100"
                                value={isMuted ? 0 : volume}
                                onChange={handleVolumeChange}
                                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Initial Screen */}
            {!hasStarted && (
                <div className="fixed inset-0 z-[9999] bg-stone-100 flex flex-col items-center justify-center p-4">
                    <div className={`absolute left-1/2 -translate-x-1/2 w-full max-w-lg px-4 ${isMobile ? "top-32" : "top-8"}`}>
                        <div className={`relative backdrop-blur-xl bg-white/70 rounded-2xl border border-white/50 shadow-lg transition-all duration-300 ${isFocused ? "shadow-xl bg-white/90 scale-[1.02]" : ""}`}>
                            <div className="relative flex items-center">
                                <div className="pl-5 pr-2">
                                    <Search className={`w-4 h-4 ${isFocused ? "text-stone-600" : "text-stone-400"}`} />
                                </div>
                                <input
                                    ref={inputRef}
                                    type="text"
                                    placeholder="Search YouTube or paste a link"
                                    value={videoUrl}
                                    onChange={(e) => {
                                        setVideoUrl(e.target.value);
                                        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
                                        if (e.target.value.trim().length > 2) {
                                            searchTimeoutRef.current = setTimeout(() => handleConfirm(), 500);
                                        } else if (e.target.value.trim().length === 0) {
                                            setSearchResults([]);
                                        }
                                    }}
                                    onFocus={() => setIsFocused(true)}
                                    onBlur={() => setTimeout(() => setIsFocused(false), 200)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
                                    className="flex-1 bg-transparent py-3 pr-4 text-stone-800 text-[14px] font-light placeholder:text-stone-400 focus:outline-none"
                                    autoFocus
                                />
                                <div className="pr-2">
                                    <button
                                        onClick={handleConfirm}
                                        disabled={!videoUrl.trim() ? true : false}
                                        className={`w-10 h-10 rounded-xl bg-gradient-to-b from-stone-700 to-stone-900 flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${videoUrl.trim() ? "opacity-100" : "opacity-40"}`}
                                    >
                                        {isSearching
                                            ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            : <Search className="w-4 h-4 text-white" />
                                        }
                                    </button>
                                </div>
                            </div>

                            {/* Search Results */}
                            {searchResults.length > 0 && isFocused && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 overflow-hidden p-1">
                                    {searchResults.map((result) => (
                                        <button
                                            key={result.id}
                                            onClick={() => {
                                                playVideoFromUrl(`https://www.youtube.com/watch?v=${result.id}`, result.channel, result.title);
                                                setSearchResults([]);
                                            }}
                                            className="w-full flex items-center gap-3 p-2 hover:bg-gradient-to-b hover:from-[#5c9ae6] hover:to-[#407ad6] rounded-xl transition-all text-left group"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-sm font-medium text-gray-800 truncate group-hover:text-white">{result.title}</h4>
                                                <p className="text-[11px] text-gray-500 truncate group-hover:text-white/90">{result.channel}</p>
                                            </div>
                                            <Play size={12} className="text-blue-500 opacity-0 group-hover:opacity-100 group-hover:text-white mr-2" fill="currentColor" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex justify-center mt-8">
                            <button
                                onClick={() => setHasStarted(true)}
                                className="text-stone-400 hover:text-stone-600 text-[11px] uppercase tracking-widest transition-colors font-medium"
                            >
                                Skip
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 3D Canvas */}
            <div className={`w-[370px] h-[600px] ${isMobile ? "mx-auto" : ""}`}>
                <Canvas camera={{ position: isMobile ? [0, 0, 13.5] : [0, 1.4, 15], fov: isMobile ? 25 : 20 }}>
                    <ambientLight intensity={0.5} />
                    <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} />
                    <pointLight position={[-10, -10, -10]} intensity={1} />
                    <Suspense fallback={null}>
                        <group>
                            <Model />
                            <ScreenOverlay
                                videoId={currentVideoId}
                                title={currentIndex >= 0 && queue[currentIndex] ? queue[currentIndex].title : ''}
                                channelName={currentIndex >= 0 && queue[currentIndex] ? queue[currentIndex].channel : ''}
                                index={currentIndex + 1}
                                total={queue.length}
                                onPlayerReady={handlePlayerReady}
                                onStateChange={handleStateChange}
                                progress={progress}
                                currentTime={currentTime}
                                duration={duration}
                                isPaused={isPaused}
                                onLoad={() => setIsModelLoaded(true)}
                                onGoHome={handleGoHome}
                                showHome={showHome}
                                isLooping={isLooping}
                                onToggleLoop={() => setIsLooping(!isLooping)}
                            />
                        </group>
                    </Suspense>
                    <Environment preset="studio" />
                    <OrbitControls makeDefault enableZoom={true} minDistance={0.69} maxDistance={0.69} enablePan={false} />
                    <ContactShadows position={[0, -2, 0]} opacity={0.4} scale={10} blur={2.5} far={4} />
                </Canvas>
            </div>

            {!isMobile && (
                <div className="fixed bottom-20 left-8 text-[10px] text-stone-500 opacity-60 pointer-events-none select-none">
                    if you can't see the screen, try Cmd + or Cmd -
                </div>
            )}
        </>
    );
}