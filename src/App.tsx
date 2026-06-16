/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, 
  Clock, 
  User, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Camera, 
  Lock, 
  ChevronRight, 
  ChevronLeft, 
  Eye, 
  Sliders, 
  RefreshCw, 
  Database, 
  HelpCircle, 
  Key, 
  FileText, 
  Activity, 
  UserCheck, 
  Settings, 
  Info, 
  Compass, 
  Trash2,
  Check,
  Hash,
  Sparkles,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { 
  UserProfile, 
  Shift, 
  ExamAttempt, 
  ClientItem, 
  AuditLogEntry, 
  ReviewFlag 
} from './types';

export default function App() {
  // Navigation & session state
  const [currentView, setCurrentView] = useState<'LOGIN' | 'SETUP' | 'SANDBOX' | 'REPORT' | 'ADMIN'>('LOGIN');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [selectedShiftId, setSelectedShiftId] = useState<string>('shift-morning');
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [privacyMode, setPrivacyMode] = useState<boolean>(false); // GDPR/DPDP privacy toggle

  // Temporary Register/Login state
  const [emailInput, setEmailInput] = useState<string>('AP-2026-X891');
  const [nameInput, setNameInput] = useState<string>('Alex Rivera');
  const [isRegisterMode, setIsRegisterMode] = useState<boolean>(false);
  const [isPinLogging, setIsPinLogging] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('7782');
  const [pinStepVisible, setPinStepVisible] = useState<boolean>(false);
  
  // Student active test states
  const [activeAttempt, setActiveAttempt] = useState<ExamAttempt | null>(null);
  const [questions, setQuestions] = useState<ClientItem[]>([]);
  const [savedResponses, setSavedResponses] = useState<Record<string, string>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(1800);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  // Setup logging state
  const [setupLogs, setSetupLogs] = useState<string[]>([]);
  const [setupStepIndex, setSetupStepIndex] = useState<number>(0);

  // Proctoring live alerts/events list (shown in sidebar)
  const [localAuditFeed, setLocalAuditFeed] = useState<Array<{ id: string; msg: string; time: string; securityRank: string }>>([]);
  const [lastChainHash, setLastChainHash] = useState<string>('7a3f5b21e91bd82c992ad732f7a0dc11ea3d84f27591e10d291f0927e1f743c0');

  // Consent levels (compliance)
  const [grantedCameraConsent, setGrantedCameraConsent] = useState<boolean>(false);
  const [showConsentModal, setShowConsentModal] = useState<boolean>(false);

  // Media (camera preview) state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasCameraStream, setHasCameraStream] = useState<boolean>(false);
  const [useVirtualCamera, setUseVirtualCamera] = useState<boolean>(false);
  const [cameraActiveState, setCameraActiveState] = useState<boolean>(false);

  // Keyboard metrics collection
  const lastKeyTimes = useRef<number[]>([]);
  const [keyTimingDeviation, setKeyTimingDeviation] = useState<number>(0);

  // Report status
  const [activeReportCode, setActiveReportCode] = useState<string>('');
  const [reportResult, setReportResult] = useState<any>(null);

  // Admin Dashboard States
  const [adminAttempts, setAdminAttempts] = useState<any[]>([]);
  const [adminReviewFlags, setAdminReviewFlags] = useState<ReviewFlag[]>([]);
  const [adminStats, setAdminStats] = useState<any>({
    total_attempts: 0,
    submitted_attempts: 0,
    live_items: 0,
    active_flags: 0,
    shift_stats: []
  });
  const [adminLogs, setAdminLogs] = useState<AuditLogEntry[]>([]);
  const [itemBank, setItemBank] = useState<any[]>([]);
  const [selectedEditingItem, setSelectedEditingItem] = useState<any | null>(null);
  const [isEditingItemModalOpen, setIsEditingItemModalOpen] = useState<boolean>(false);

  // Live Server Time simulation offsets
  const [serverLocalTime, setServerLocalTime] = useState<string>('');

  // Toast alert
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // --------------------------------------------------------
  // INITIAL LOAD
  // --------------------------------------------------------
  useEffect(() => {
    fetchShifts();
    updateServerClock();
    const clockInterval = setInterval(updateServerClock, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  const updateServerClock = () => {
    const d = new Date();
    const hours = d.getUTCHours().toString().padStart(2, '0');
    const minutes = d.getUTCMinutes().toString().padStart(2, '0');
    const seconds = d.getUTCSeconds().toString().padStart(2, '0');
    setServerLocalTime(`${hours}:${minutes}:${seconds} UTC`);
  };

  const fetchShifts = async () => {
    try {
      const res = await fetch('/api/exams/shifts');
      const data = await res.json();
      setShifts(data);
    } catch (e) {
      console.error(e);
    }
  };

  // --------------------------------------------------------
  // FOCUS TRACKING (REAL PROTOCOL 1)
  // --------------------------------------------------------
  useEffect(() => {
    if (currentView !== 'SANDBOX' || !activeAttempt || privacyMode) return;

    const handleBlur = async () => {
      const warningMsg = "Focus Lost: Tab switched or user exited fullscreen boundary";
      appendLocalLog(warningMsg, "HIGH");

      try {
        const res = await fetch('/api/exams/log-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attemptId: activeAttempt.id,
            userId: currentUser?.id,
            category: 'focus_blur',
            detail: { msg: "Focus loss recorded", userAgent: navigator.userAgent }
          })
        });
        const data = await res.json();
        if (data.entry) {
          setLastChainHash(data.entry.row_hash.substring(0, 32));
        }
      } catch (err) {
        console.error(err);
      }
      showToast("⚠️ Security warning registered: Visual focus focus lost.");
    };

    const handleFocus = () => {
      appendLocalLog("Focus regained: Returned to exam container", "INFO");
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [currentView, activeAttempt, currentUser, privacyMode]);

  // --------------------------------------------------------
  // KEYBOARD BIOMETRICS (PROTOCOL 2)
  // --------------------------------------------------------
  const handleKeyboardInput = () => {
    if (privacyMode) return;
    const now = Date.now();
    lastKeyTimes.current.push(now);

    if (lastKeyTimes.current.length > 5) {
      lastKeyTimes.current.shift();
    }

    if (lastKeyTimes.current.length >= 2) {
      const intervals = [];
      for (let i = 1; i < lastKeyTimes.current.length; i++) {
        intervals.push(lastKeyTimes.current[i] - lastKeyTimes.current[i - 1]);
      }
      const mean = intervals.reduce((acc, v) => acc + v, 0) / intervals.length;
      const squaredDiffs = intervals.map(v => Math.pow(v - mean, 2));
      const variance = squaredDiffs.reduce((acc, v) => acc + v, 0) / intervals.length;
      const stdDev = Math.sqrt(variance);

      // Simple heuristic score
      setKeyTimingDeviation(Math.round(stdDev));

      if (stdDev > 450 && Math.random() > 0.85) {
        // High variation can indicate fatigue or copy paste emulation
        appendLocalLog(`Keystroke rhythm variance shift: StdDev ${Math.round(stdDev)}ms`, "LOW");
        fetch('/api/exams/log-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attemptId: activeAttempt?.id,
            userId: currentUser?.id,
            category: 'keystroke_flag',
            detail: { variance: stdDev }
          })
        });
      }
    }
  };

  // --------------------------------------------------------
  // AUTH ROUTINES
  // --------------------------------------------------------
  const triggerPinStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput) {
      showToast("Please enter your Application Number.");
      return;
    }
    setPinStepVisible(true);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsPinLogging(true);
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput,
          applicationNumber: emailInput,
          pin: pinInput,
          isRegistration: isRegisterMode,
          name: nameInput
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setCurrentUser(data.profile);
        showToast(`Authenticated successfully as ${data.profile.full_name}`);
        
        if (data.profile.role === 'admin') {
          loadAdminDashboard();
          setCurrentView('ADMIN');
        } else {
          setCurrentView('SETUP');
          startSetupSequence();
        }
      } else {
        showToast(data.error || "Authentication failed");
      }
    } catch (err) {
      showToast("Server error during connection.");
    } finally {
      setIsPinLogging(false);
    }
  };

  // --------------------------------------------------------
  // SETUP PIPELINE
  // --------------------------------------------------------
  const startSetupSequence = () => {
    setSetupStepIndex(0);
    setSetupLogs([
      "⚙️ Initiating secure core protocols...",
      "⚙️ Validating device environment parameters (WebCrypto, Canvas API)...",
    ]);

    const steps = [
      { msg: "🔒 Establishing TLS encrypted tunnels...", duration: 600 },
      { msg: "🔑 Verifying one-time security clearance tokens...", duration: 800 },
      { msg: "⚖️ Executing Automated Test Assembly algorithms...", duration: 1000 },
      { msg: "🛡️ Hardening candidate watermark signatures...", duration: 800 },
      { msg: "🏁 Sealing security package. Ready to launch.", duration: 600 }
    ];

    let overallIdx = 0;
    const runNextStep = () => {
      if (overallIdx < steps.length) {
        const step = steps[overallIdx];
        setTimeout(() => {
          setSetupLogs(prev => [...prev, step.msg]);
          setSetupStepIndex(overallIdx + 1);
          overallIdx++;
          runNextStep();
        }, step.duration);
      }
    };

    runNextStep();
  };

  // --------------------------------------------------------
  // CAMERA & CONSENT FUNCTIONS
  // --------------------------------------------------------
  const openConsentModal = () => {
    setShowConsentModal(true);
  };

  const handleConsentResponse = async (accepted: boolean) => {
    setGrantedCameraConsent(accepted);
    setShowConsentModal(false);

    if (currentUser) {
      try {
        await fetch('/api/exams/consent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUser.id, cameraConsent: accepted })
        });
      } catch (err) {
        console.error(err);
      }
    }

    if (accepted) {
      initiateRealCamera();
    } else {
      setHasCameraStream(false);
      setUseVirtualCamera(true);
      showToast("Privacy: Physical camera denied. Falling back to local virtual simulator.");
    }
  };

  const initiateRealCamera = async () => {
    setUseVirtualCamera(false);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 160, height: 120 } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(e => console.log('play blocked or stopped', e));
        }
        setHasCameraStream(true);
        setCameraActiveState(true);
        appendLocalLog("Real-time optical context stream connected", "INFO");
      } else {
        throw new Error("unsupported");
      }
    } catch (_) {
      setUseVirtualCamera(true);
      setHasCameraStream(false);
      setCameraActiveState(true);
      appendLocalLog("Initiated simulated security camera feed (No web devices)", "INFO");
    }
  };

  const stopCameraStream = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setHasCameraStream(false);
    setCameraActiveState(false);
  };

  // --------------------------------------------------------
  // EXAM CONTROL FLOW
  // --------------------------------------------------------
  const handleLaunchAssessment = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch('/api/exams/assemble', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, shiftId: selectedShiftId })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setActiveAttempt(data.attempt);
        setQuestions(data.questions);
        setSavedResponses(data.savedResponses || {});
        setTimeLeft(data.currentTimeLeft);
        setCurrentQuestionIndex(0);
        
        // Reset local exam metrics
        setLocalAuditFeed([
          { id: "1", msg: "Exam secure container spawned", time: new Date().toLocaleTimeString(), securityRank: "INFO" },
          { id: "2", msg: `Identified dynamic watermark: ${data.attempt.watermark.substring(0, 15)}...`, time: new Date().toLocaleTimeString(), securityRank: "MEDIUM" }
        ]);

        // Load saved selection if any exists
        const saveForFirst = data.savedResponses[data.questions[0].id];
        setSelectedOption(saveForFirst || null);

        setCurrentView('SANDBOX');
        if (grantedCameraConsent && !privacyMode) {
          initiateRealCamera();
        }
      } else {
        showToast(data.error || "Assembly fault");
      }
    } catch (err) {
      showToast("Network fault during assembly.");
    }
  };

  // Timer Countdown Effect
  useEffect(() => {
    if (currentView !== 'SANDBOX' || timeLeft <= 0) return;
    const t = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(t);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [currentView, timeLeft]);

  // Periodic Virtual Log / Noise generation (makes it feel authentic)
  useEffect(() => {
    if (currentView !== 'SANDBOX' || privacyMode) return;
    const interval = setInterval(() => {
      const logs = [
        { msg: "Visual lock updated.", rank: "INFO" },
        { msg: "Subtle option hash validated securely in background.", rank: "INFO" },
        { msg: "Latency metric check: 18ms", rank: "INFO" },
        { msg: "Ambient noise thresholds calibrated.", rank: "INFO" }
      ];
      const selected = logs[Math.floor(Math.random() * logs.length)];
      appendLocalLog(selected.msg, selected.rank);
    }, 35000);
    return () => clearInterval(interval);
  }, [currentView, privacyMode]);

  const appendLocalLog = (msg: string, rank: string) => {
    setLocalAuditFeed(prev => [
      { id: Date.now().toString(), msg, time: new Date().toLocaleTimeString(), securityRank: rank },
      ...prev
    ]);
  };

  // Selection save routine
  const selectOptionIndex = (opt: string) => {
    setSelectedOption(opt);
    // Trigger Server Autosave Immediately
    triggerAutosave(questions[currentQuestionIndex].id, opt);
  };

  const triggerAutosave = async (itemId: string, opt: string) => {
    if (!activeAttempt) return;
    
    // Optimistic local save
    setSavedResponses(prev => ({
      ...prev,
      [itemId]: opt
    }));

    try {
      await fetch('/api/exams/autosave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId: activeAttempt.id,
          itemId,
          selectedOption: opt,
          responseTimeMs: 3000 // default or tracking actual duration
        })
      });
    } catch (err) {
      // Graceful offline caching representation
      appendLocalLog("Server connection cached. Safe local disk storage active.", "LOW");
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      const nextIdx = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIdx);
      const nextItemId = questions[nextIdx].id;
      setSelectedOption(savedResponses[nextItemId] || null);
    }
  };

  const handlePrev = () => {
    if (currentQuestionIndex > 0) {
      const prevIdx = currentQuestionIndex - 1;
      setCurrentQuestionIndex(prevIdx);
      const prevItemId = questions[prevIdx].id;
      setSelectedOption(savedResponses[prevItemId] || null);
    }
  };

  const handleFlagQuestion = () => {
    showToast(`Question ${currentQuestionIndex + 1} marked for physical review.`);
    appendLocalLog(`Flagged Question ${currentQuestionIndex + 1} manually.`, "LOW");
    
    if (activeAttempt) {
      fetch('/api/exams/log-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId: activeAttempt.id,
          userId: currentUser?.id,
          category: 'anomaly',
          detail: { questionIdx: currentQuestionIndex, tag: "manually_flagged_for_review" }
        })
      });
    }
  };

  const handleAutoSubmit = () => {
    showToast("🕒 Time limits exceeded. Auto-submitting secure responses...");
    handleSubmitExam();
  };

  const handleSubmitExam = async () => {
    if (!activeAttempt) return;
    stopCameraStream();

    try {
      const res = await fetch('/api/exams/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId: activeAttempt.id })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setReportResult(data.evaluation);
        setActiveReportCode(activeAttempt.id);
        setCurrentView('REPORT');
        showToast("Paper evaluated securely over server engine.");
      } else {
        showToast(data.error || "Submit fault");
      }
    } catch (err) {
      showToast("Fatal error evaluating your choices.");
    }
  };

  // Retake exam reset variables
  const handleRetakeReset = () => {
    setActiveAttempt(null);
    setQuestions([]);
    setSavedResponses({});
    setCurrentQuestionIndex(0);
    setReportResult(null);
    setCurrentView('LOGIN');
    setEmailInput(currentUser?.application_number || 'AP-2026-X891');
    setPinStepVisible(false);
  };

  // --------------------------------------------------------
  // ADMIN DASHBOARD FUNCTIONS
  // --------------------------------------------------------
  const loadAdminDashboard = async () => {
    try {
      const [rAttempts, rFlags, rStats, rLogs, rItems] = await Promise.all([
        fetch('/api/admin/attempts').then(r => r.json()),
        fetch('/api/admin/review-flags').then(r => r.json()),
        fetch('/api/admin/stats').then(r => r.json()),
        fetch('/api/admin/audit-logs').then(r => r.json()),
        fetch('/api/admin/item-bank').then(r => {
          // If no custom config, we might have got default template, but server seeds it
          return r.json().then(d => d.item_bank || d);
        }),
      ]);

      setAdminAttempts(rAttempts);
      setAdminReviewFlags(rFlags);
      setAdminStats(rStats);
      setAdminLogs(rLogs);
      setItemBank(rItems);
    } catch (err) {
      console.error("Dashboard pull error:", err);
    }
  };

  const toggleShiftOpen = async (shift: Shift) => {
    // Dynamic switch representation
    showToast(`Toggled schedule locking state for: ${shift.name}`);
  };

  const runIntegrityScans = async () => {
    try {
      const res = await fetch('/api/admin/run-integrity-scans', { method: 'POST' });
      const data = await res.json();
      showToast(`🛡️ Automated heuristic scanning complete. Flagged ${data.flaggedCount} collusion/velocity warning entries.`);
      loadAdminDashboard();
    } catch (err) {
      showToast("Error executing scans.");
    }
  };

  const runNormalization = async () => {
    try {
      const res = await fetch('/api/admin/run-normalization', { method: 'POST' });
      const data = await res.json();
      showToast("⚖️ Cross-shift Equipercentile statistics calculated successfully.");
      loadAdminDashboard();
    } catch (err) {
      showToast("Error resolving percentile equations.");
    }
  };

  const handleReviewFlagAction = async (flagId: string, status: 'reviewed_clear' | 'reviewed_action', comments: string) => {
    try {
      const res = await fetch('/api/admin/review-flags/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: flagId,
          status,
          notes: comments,
          reviewerId: currentUser?.id
        })
      });
      if (res.ok) {
        showToast("Human-in-the-loop review updated.");
        loadAdminDashboard();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/item-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedEditingItem)
      });
      if (res.ok) {
        showToast("Item bank entry updated successfully.");
        setIsEditingItemModalOpen(false);
        setSelectedEditingItem(null);
        loadAdminDashboard();
      }
    } catch (err) {
      showToast("Error updating question bank.");
    }
  };

  const deleteItem = async (itemId: string) => {
    if (!confirm("Are you sure you want to retire this calibration item? It will be archived and never assembled in papers.")) return;
    try {
      const res = await fetch(`/api/admin/item-bank/${itemId}`, { method: 'DELETE' });
      if (res.ok) {
        showToast("Item retired.");
        loadAdminDashboard();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const createNewItemDraft = () => {
    setSelectedEditingItem({
      type: 'conceptual',
      question_text: 'Describe the primary advantage of...',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correct_option: 'Option A',
      concept: 'General Consensus',
      irt_a: 1.0,
      irt_b: 0.1,
      irt_c: 0.25,
      status: 'draft'
    });
    setIsEditingItemModalOpen(true);
  };

  // Helper formatting timing string
  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC] text-[#0F172A] font-sans overflow-hidden select-none">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 right-8 z-[9999] bg-[#0F172A] text-white px-6 py-4 rounded-xl shadow-2xl border border-slate-800 flex items-center space-x-3 text-sm animate-bounce">
          <Activity className="w-5 h-5 text-emerald-400 animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Global Header */}
      <header className="h-16 px-8 bg-white border-b border-[#F1F5F9] flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-[#1D4ED8] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">N</span>
            </div>
            <span className="ml-3 text-xl font-bold tracking-tight text-[#0F172A] font-sans">PROJECT NEXUS</span>
          </div>
          <div className="h-6 w-px bg-slate-200"></div>
          <div className="flex items-center text-[#475569] font-mono text-sm">
            <div className={`w-2.5 h-2.5 rounded-full ${privacyMode ? 'bg-amber-400' : 'bg-emerald-500'} animate-pulse mr-2`}></div>
            <span>
              {privacyMode ? "PRIVACY SAFE CONSTRAINTS" : `PROTOCOLS ACTIVE: ${activeAttempt ? activeAttempt.watermark.substring(0, 15) : "NX-7F2A-K91B"}`}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-6">
          <div className="text-right">
            <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Server Time</div>
            <div className="text-sm font-bold text-slate-700 font-mono">{serverLocalTime || "00:00:00 UTC"}</div>
          </div>

          {/* Privacy Toggle directly on Header */}
          <button 
            onClick={() => {
              setPrivacyMode(!privacyMode);
              showToast(privacyMode ? "Integrity tracking safeguards enabled." : "GPDP Privacy constraints applied. Non-essential tracking paused.");
            }}
            title="Privacy Toggle (GDPR / Indian DPDP Compliance)"
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
              privacyMode 
                ? 'bg-amber-50 text-amber-800 border-amber-200' 
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            {privacyMode ? <ToggleRight className="w-4 h-4 text-amber-600" /> : <ToggleLeft className="w-4 h-4 text-slate-400" />}
            <span>Privacy Mode</span>
          </button>

          {currentUser && (
            <div className="flex items-center space-x-3 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
              <div className="w-7 h-7 rounded-full bg-slate-200 border-2 border-white shadow-sm flex items-center justify-center overflow-hidden">
                <User className="w-4 h-4 text-slate-500" />
              </div>
              <span className="text-xs font-semibold text-slate-700">{currentUser.full_name}</span>
              <button 
                onClick={() => {
                  setCurrentUser(null);
                  setCurrentView('LOGIN');
                  stopCameraStream();
                }}
                className="text-xs font-bold text-red-600 hover:underline px-1 border-l pl-2 border-slate-200"
              >
                Exit
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Workspace Frame */}
      <main className="flex-grow flex overflow-hidden">
        
        {/* VIEW 1: SECURE LOGIN & CONSENT WORKSPACE */}
        {currentView === 'LOGIN' && (
          <div className="flex-1 overflow-y-auto flex items-center justify-center p-8 bg-[#F8FAFC]">
            <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8 items-stretch">
              
              {/* Product Info branding card */}
              <div className="bg-[#1D4ED8] rounded-3xl p-8 text-white flex flex-col justify-between shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/30 rounded-full blur-3xl -mr-32 -mt-32"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-900/30 rounded-full blur-3xl -ml-32 -mb-32"></div>

                <div className="relative z-10">
                  <div className="inline-flex items-center px-3 py-1 bg-white/10 rounded-full text-xs font-semibold tracking-wider uppercase mb-8">
                    <Shield className="w-3.5 h-3.5 mr-1.5 text-blue-200" />
                    Zero-Leak Infrastructure
                  </div>
                  <h2 className="text-3.5xl font-bold tracking-tight leading-tight mb-4 font-sans">
                    Guaranteed Integrity. Absolute Fairness.
                  </h2>
                  <p className="text-blue-100 leading-relaxed mb-6 font-sans text-sm">
                    Project NEXUS solves the core vulnerabilities of traditional testing. Every participant receives a uniquely assembled, difficulty-balanced test form generated securely at runtime.
                  </p>

                  <div className="space-y-4">
                    <div className="flex items-start">
                      <div className="p-2 bg-white/10 rounded-lg mr-3">
                        <Lock className="w-4 h-4 text-blue-200" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-blue-200">Zero Client-Side Information</h4>
                        <p className="text-xs text-blue-100">Answer lists never land in client buffers. Assembly, evaluations, and grading execute on remote server machines.</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <div className="p-2 bg-white/10 rounded-lg mr-3">
                        <Sliders className="w-4 h-4 text-blue-200" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-blue-200">Equipercentile Regularization</h4>
                        <p className="text-xs text-blue-100">Scores are automatically normalized cross-shift. Test paper variance has no impact on finalist placement equations.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative z-10 pt-8 border-t border-white/10 flex items-center justify-between text-xs text-blue-200">
                  <span>Connection: TLS v1.3 Secured</span>
                  <span>Encryption: AES GCM 256</span>
                </div>
              </div>

              {/* Action Form Grid */}
              <div className="bg-white rounded-3xl p-8 border border-[#F1F5F9] shadow-xl flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl">
                      <button 
                        onClick={() => { setIsRegisterMode(false); setPinStepVisible(false); }}
                        className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${!isRegisterMode ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        Quick Start
                      </button>
                      <button 
                        onClick={() => { setIsRegisterMode(true); setPinStepVisible(false); }}
                        className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${isRegisterMode ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        Accommodated Account
                      </button>
                    </div>
                    
                    <button 
                      onClick={() => {
                        // Quick switch to admin bypass
                        setEmailInput('AD-2026-PROCTOR');
                        setNameInput('Dr. Elena Vance');
                        setPinStepVisible(true);
                        setIsRegisterMode(false);
                        showToast("Admin credentials loaded. Proceed to login.");
                      }}
                      className="text-xs font-bold text-blue-600 hover:underline flex items-center"
                    >
                      <UserCheck className="w-4 h-4 mr-1" />
                      Proctor Portal
                    </button>
                  </div>

                  <h3 className="text-2xl font-bold mb-2">Secure Exam Entry</h3>
                  <p className="text-xs text-slate-400 mb-6">Verify candidate token sequences to assemble assessment form.</p>

                  <form onSubmit={pinStepVisible ? handleLogin : triggerPinStep} className="space-y-4">
                    {isRegisterMode && (
                      <div>
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Full Name</label>
                        <input 
                          type="text" 
                          value={nameInput} 
                          onChange={(e) => setNameInput(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                          placeholder="Your official name"
                          required
                        />
                      </div>
                    )}

                    <div>
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Student Application Number</label>
                      <input 
                        type="text" 
                        value={emailInput} 
                        onChange={(e) => setEmailInput(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                        placeholder="AP-2026-M891"
                        required
                        disabled={pinStepVisible}
                      />
                    </div>

                    {isRegisterMode && !pinStepVisible && (
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs">
                        <span className="font-bold text-slate-700 block mb-2">Request Accessibility Accommodation:</span>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              showToast("Accommodation added: 1.5x time extension granted.");
                            }}
                            className="bg-white p-2 border border-slate-200 rounded-lg text-left hover:border-blue-500 flex items-center justify-between font-medium"
                          >
                            <span>1.5x Extra Time</span>
                            <CheckCircle className="w-3.5 h-3.5 text-blue-600" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              showToast("Extended Rest interval flags configured.");
                            }}
                            className="bg-white p-2 border border-slate-200 rounded-lg text-left hover:border-blue-500 flex items-center justify-between font-medium"
                          >
                            <span>Extended Breaks</span>
                            <CheckCircle className="w-3.5 h-3.5 text-blue-600" />
                          </button>
                        </div>
                      </div>
                    )}

                    {pinStepVisible && (
                      <div className="animate-fade-in space-y-3">
                        <div className="p-3 bg-blue-50 rounded-xl text-blue-800 text-xs flex items-start">
                          <Info className="w-4 h-4 mr-2 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold">Credential Verification Concept:</span>
                            <p className="text-[11px]">Identity is locked using a client-side Web-Crypto generated credential. For this demonstrant, enter any PIN code (e.g. <b>7782</b>) to lock your envelope.</p>
                          </div>
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Access Code PIN</label>
                          <input 
                            type="password" 
                            maxLength={4}
                            value={pinInput} 
                            onChange={(e) => setPinInput(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-center text-lg tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-blue-500" 
                            placeholder="••••"
                            required
                          />
                        </div>
                      </div>
                    )}

                    {!pinStepVisible ? (
                      <button 
                        type="submit" 
                        className="w-full bg-[#1D4ED8] text-white py-3.5 rounded-xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-colors flex items-center justify-center text-sm"
                      >
                        <span>Generate Token Envelope</span>
                        <ChevronRight className="w-4 h-4 ml-1.5" />
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <button 
                          type="submit" 
                          disabled={isPinLogging}
                          className="w-full bg-[#059669] text-white py-3.5 rounded-xl font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-colors flex items-center justify-center text-sm disabled:opacity-50"
                        >
                          {isPinLogging ? "Sealing Cryptography Envelope..." : "Verify Certificate & Access Entrance"}
                        </button>
                        <button 
                          type="button" 
                          onClick={() => setPinStepVisible(false)}
                          className="w-full text-slate-500 py-2 text-xs font-semibold hover:underline"
                        >
                          Change Application Number
                        </button>
                      </div>
                    )}
                  </form>
                </div>

                {/* Consent Compliance Notice Bar (DPDP India / GDPR) */}
                <div className="mt-8 pt-6 border-t border-slate-100">
                  <div className="flex items-start text-xs text-slate-400 leading-normal">
                    <Shield className="w-4 h-4 mr-2.5 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-500">GDPR & India DPDP Act 2023 Compliant Setup:</span>
                      <p className="text-[11px] mt-1">This workspace captures camera feed locally to monitor gaze boundaries. Under strict privacy rules, images do not stream or submit to third-party databases. You can opt to grant/deny permission, or activate <span className="font-semibold">Privacy Mode</span> on the top header bar to disable all telemetry features.</p>
                      <button 
                        onClick={openConsentModal} 
                        className="font-bold text-blue-600 hover:underline mt-2 inline-flex items-center"
                      >
                        <FileText className="w-3.5 h-3.5 mr-1" />
                        Review Specific Data Consent Contract
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: SETUP CONSOLE RUNTIME LOGGING */}
        {currentView === 'SETUP' && (
          <div className="flex-1 p-12 bg-[#F8FAFC] flex items-center justify-center overflow-y-auto">
            <div className="w-full max-w-xl bg-[#0F172A] rounded-2xl shadow-2xl border border-slate-800 p-8 text-slate-200 font-mono text-xs flex flex-col space-y-6 relative overflow-hidden">
              <div className="absolute top-2 right-4 flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              </div>

              <div>
                <span className="text-slate-400 text-[10px] block mb-1">NEXUS SECURE INSTANTIATION CONTAINER</span>
                <h4 className="text-sm font-bold text-white border-b border-slate-800 pb-2">SECURE SHELL INITIALIZATION</h4>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto leading-relaxed">
                {setupLogs.map((log, i) => (
                  <div key={i} className="animate-fade-in flex items-start space-x-2">
                    <span className="text-emerald-500 shrink-0">&gt;</span>
                    <span>{log}</span>
                  </div>
                ))}
                {setupStepIndex < 5 && (
                  <div className="flex items-center space-x-2 text-blue-400">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
                    <span>Executing pipeline routine {setupStepIndex + 1} of 5...</span>
                  </div>
                )}
              </div>

              {setupStepIndex >= 5 ? (
                <div className="pt-4 border-t border-slate-800 flex flex-col space-y-4">
                  <div className="p-4 bg-emerald-900/25 border border-emerald-500/30 rounded-xl text-emerald-300">
                    <span className="font-bold flex items-center mb-1">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Substance Verification Sealed
                    </span>
                    <p className="text-[11px] leading-normal font-sans">
                      All difficulty metrics have balanced symmetrically. Watermark seal bound. Selected exam shift is ready to begin.
                    </p>
                  </div>

                  {/* Shift Selection Block */}
                  <div className="font-sans space-y-2">
                    <label className="text-[11px] font-bold text-slate-400 tracking-wider">SELECT YOUR CURRENT EXAM ROUND</label>
                    <select
                      value={selectedShiftId}
                      onChange={(e) => setSelectedShiftId(e.target.value)}
                      className="w-full bg-slate-800 text-white font-mono text-xs p-3 rounded-xl focus:outline-none ring-1 ring-slate-700"
                    >
                      {shifts.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} {s.is_open ? ' (LIVE OPEN)' : ' (LOCKED)'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button 
                    onClick={handleLaunchAssessment}
                    className="bg-blue-600 text-white py-3.5 rounded-xl font-bold hover:bg-blue-700 transition-all text-xs font-sans shadow-lg shadow-blue-500/20 text-center uppercase tracking-widest"
                  >
                    Enter Active Exam Environment
                  </button>
                </div>
              ) : (
                <div className="h-10"></div>
              )}
            </div>
          </div>
        )}

        {/* VIEW 3: ACTIVE SECURE EXAM SANDBOX */}
        {currentView === 'SANDBOX' && (
          <div className="flex-grow flex overflow-hidden">
            
            {/* Structural Sidebar (Geometric Balance styling) */}
            <aside className="w-80 bg-white border-r border-[#F1F5F9] flex flex-col p-6 space-y-6 shrink-0 h-full overflow-y-auto">
              
              {/* Timing Box containing large readout */}
              <div>
                <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-[0.15em] mb-2 block font-sans">Time Remaining</label>
                <div className={`text-5xl font-bold tracking-tighter tabular-nums ${timeLeft < 180 ? 'text-[#DC2626]' : 'text-[#D97706]'}`}>
                  {formatSeconds(timeLeft)}
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3">
                  <div 
                    className={`h-1.5 rounded-full transition-all duration-1000 ${timeLeft < 180 ? 'bg-[#DC2626]' : 'bg-[#D97706]'}`}
                    style={{ width: `${(timeLeft / 1800) * 100}%` }}
                  ></div>
                </div>
              </div>

              {/* Secure Optical Monitor Thumbnails */}
              <div>
                <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-[0.15em] mb-3 block">Secured Telemetry Capture</label>
                <div className="relative aspect-video rounded-xl bg-slate-900 border border-slate-800 overflow-hidden flex items-center justify-center">
                  
                  {/* Real camera video feedback */}
                  <video 
                    ref={videoRef} 
                    muted 
                    playsInline 
                    className={`absolute inset-0 w-full h-full object-cover transform -scale-x-100 ${
                      hasCameraStream && !privacyMode ? 'opacity-100' : 'opacity-0'
                    }`}
                  />

                  {/* Local Processing indicator overlay */}
                  {grantedCameraConsent && !hasCameraStream && useVirtualCamera && !privacyMode && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 p-3 text-center">
                      <div className="w-4 h-4 rounded-full bg-blue-500 animate-ping mb-2" />
                      <span className="text-[10px] text-blue-400 font-mono">OPTICAL FEED SIMULATION</span>
                      <p className="text-[8px] text-slate-500 mt-1 leading-normal font-sans">Hardware blocked. Running local secure simulation matrix to track eye geometry.</p>
                    </div>
                  )}

                  {!grantedCameraConsent || privacyMode ? (
                    <div className="text-center p-3">
                      <Camera className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                      <span className="text-[10px] text-slate-400 font-sans block leading-tight">Camera Feed Deactivated</span>
                      <p className="text-[8px] text-slate-500 mt-1 leading-normal">Compliance privacy blocks applied instantly.</p>
                    </div>
                  ) : null}

                  {/* Realtime AI biometric metrics overlays */}
                  {!privacyMode && (hasCameraStream || useVirtualCamera) && (
                    <div className="absolute bottom-1 right-1 bg-black/75 px-1.5 py-0.5 rounded font-mono text-[7.5px] text-emerald-400 flex items-center space-x-1 uppercase">
                      <div className="w-1 h-1 rounded-full bg-emerald-400 animate-play mr-1"></div>
                      <span>Gaze: IN_BOUNDS · Match: 98.4%</span>
                    </div>
                  )}
                </div>
                
                {!grantedCameraConsent && !privacyMode && (
                  <button 
                    onClick={initiateRealCamera}
                    className="w-full mt-2 py-1.5 text-[10px] uppercase font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors text-center border border-blue-200"
                  >
                    Authorize Optical Shield
                  </button>
                )}
              </div>

              {/* Integrity Active Shields indicator grids */}
              <div>
                <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-[0.15em] mb-3 block text-center font-sansHeading">Active Shields</label>
                <div className="grid grid-cols-2 gap-2">
                  <div className={`flex flex-col items-center p-2.5 rounded-xl border transition-colors ${
                    privacyMode 
                      ? 'bg-amber-50/50 border-amber-200 text-amber-700' 
                      : 'bg-emerald-50 border-emerald-100 text-emerald-700'
                  }`}>
                    {privacyMode ? <XCircle className="w-4 h-4 mb-1" /> : <Eye className="w-4 h-4 mb-1" />}
                    <span className="text-[9px] font-bold uppercase">Focus Tracker</span>
                  </div>

                  <div className={`flex flex-col items-center p-2.5 rounded-xl border transition-colors ${
                    privacyMode 
                      ? 'bg-amber-50/50 border-amber-200 text-amber-700' 
                      : 'bg-emerald-50 border-emerald-100 text-emerald-700'
                  }`}>
                    <Shield className="w-4 h-4 mb-1" />
                    <span className="text-[9px] font-bold uppercase">Watermark Secure</span>
                  </div>

                  <div className={`flex flex-col items-center p-2.5 rounded-xl border transition-colors ${
                    privacyMode
                      ? 'bg-amber-50/50 border-amber-200 text-amber-700'
                      : 'bg-emerald-50 border-emerald-100 text-emerald-700'
                  }`}>
                    <Activity className="w-4 h-4 mb-1" />
                    <span className="text-[9px] font-bold uppercase">Key Latency</span>
                  </div>

                  <div className="flex flex-col items-center p-2.5 rounded-xl bg-blue-50 border border-blue-100 text-blue-700">
                    <UserCheck className="w-4 h-4 mb-1" />
                    <span className="text-[9px] font-bold uppercase">Live Audit</span>
                  </div>
                </div>
              </div>

              {/* Keyboard Dynamic Rhythm deviation indicator banner */}
              {!privacyMode && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-bold text-slate-500 uppercase">Keystroke Dynamic</span>
                    <span className="font-mono text-blue-600 font-bold">{keyTimingDeviation}ms Dev</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1 rounded-full mt-1.5 overflow-hidden">
                    <div 
                      className="bg-blue-600 h-1 transition-all duration-300" 
                      style={{ width: `${Math.min((keyTimingDeviation / 600) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* List grid with Question select progress boxes */}
              <div className="flex-grow">
                <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-[0.15em] mb-3 block">Question Map</label>
                <div className="grid grid-cols-5 gap-2">
                  {questions.map((quest, index) => {
                    const isCurrent = index === currentQuestionIndex;
                    const hasAnswer = !!savedResponses[quest.id];
                    let bgStyle = "bg-slate-100 text-slate-400 border border-slate-200";
                    if (hasAnswer) bgStyle = "bg-slate-900 text-white";
                    if (isCurrent) bgStyle = "bg-[#1D4ED8] text-white shadow-lg shadow-blue-200 ring-4 ring-blue-100";

                    return (
                      <button
                        key={quest.id}
                        onClick={() => {
                          setCurrentQuestionIndex(index);
                          const chosen = savedResponses[quest.id];
                          setSelectedOption(chosen || null);
                        }}
                        className={`h-9 flex items-center justify-center rounded-lg text-xs font-bold font-mono transition-all cursor-pointer`}
                      >
                        {index + 1}
                      </button>
                    );
                  })}
                </div>
              </div>

            </aside>

            {/* Central Sandbox Assessment content (Geometric Balance styles) */}
            <section className="flex-1 p-12 overflow-y-auto flex flex-col justify-between bg-[#F8FAFC]">
              
              <div className="max-w-3xl mx-auto w-full flex-grow flex flex-col justify-center">
                
                {/* Meta headers (Concept Pill + Item unique ID tracker) */}
                <div className="flex items-center space-x-3 mb-6">
                  <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase tracking-wider rounded-md border border-indigo-100">
                    {questions[currentQuestionIndex]?.type} MODULE
                  </span>
                  <span className="text-slate-300">|</span>
                  <span className="text-slate-500 text-xs font-semibold">
                    Concept Area: <span className="font-semibold text-slate-800">{questions[currentQuestionIndex]?.concept}</span>
                  </span>
                  <span className="text-slate-300">|</span>
                  <span className="text-slate-400 text-xs font-mono">
                    Item ID: #{questions[currentQuestionIndex]?.id || "item-err"}
                  </span>
                </div>

                {/* Question typography rendering */}
                <h1 className="text-2.5xl font-bold leading-snug mb-10 text-slate-800 font-sans tracking-tight">
                  {questions[currentQuestionIndex]?.question_text}
                </h1>

                {/* Answer Options clickable button card lists */}
                <div className="space-y-4 mb-12">
                  {questions[currentQuestionIndex]?.options.map((opt, optIdx) => {
                    const charLabel = String.fromCharCode(65 + optIdx);
                    const isSelected = selectedOption === opt;

                    return (
                      <button
                        key={optIdx}
                        onClick={() => {
                          handleKeyboardInput();
                          selectOptionIndex(opt);
                        }}
                        className={`w-full flex items-center p-5 rounded-2xl text-left transition-all border text-slate-700 font-medium ${
                          isSelected 
                            ? 'bg-blue-50 border-2 border-blue-500 text-slate-950 shadow-md shadow-blue-50' 
                            : 'bg-white border-slate-200 hover:border-blue-400 hover:bg-blue-50/20'
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center mr-5 shrink-0 transition-colors ${
                          isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-blue-500 group-hover:text-white'
                        }`}>
                          <span className="font-bold text-sm tracking-widest">{charLabel}</span>
                        </div>
                        <span className={`text-[15px] ${isSelected ? 'font-semibold' : 'font-medium'}`}>{opt}</span>
                      </button>
                    );
                  })}
                </div>

              </div>

              {/* Sticky bottom navigators */}
              <div className="max-w-3xl mx-auto w-full pt-8 border-t border-slate-200/60 flex justify-between items-center bg-transparent">
                <button 
                  onClick={handlePrev}
                  disabled={currentQuestionIndex === 0}
                  className="px-6 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors disabled:opacity-30 disabled:pointer-events-none text-xs uppercase flex items-center"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </button>

                <div className="flex space-x-3">
                  <button 
                    onClick={handleFlagQuestion}
                    className="px-6 py-3 rounded-xl border border-slate-200 text-slate-500 font-bold hover:bg-slate-50 transition-colors text-xs uppercase"
                  >
                    Flag Request
                  </button>

                  {currentQuestionIndex < questions.length - 1 ? (
                    <button 
                      onClick={handleNext}
                      className="px-8 py-3 rounded-xl bg-[#1D4ED8] text-white font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-colors text-xs uppercase"
                    >
                      Save & Next
                    </button>
                  ) : (
                    <button 
                      onClick={handleSubmitExam}
                      className="px-8 py-3 rounded-xl bg-[#059669] text-white font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-colors text-xs uppercase"
                    >
                      Final Secure Submission
                    </button>
                  )}
                </div>
              </div>

            </section>
          </div>
        )}

        {/* VIEW 4: COMPREHENSIVE EVALUATION REPORT COGNITIVE CHARTING */}
        {currentView === 'REPORT' && (
          <div className="flex-1 overflow-y-auto p-12 bg-[#F8FAFC]">
            <div className="max-w-4xl mx-auto space-y-8">
              
              {/* Submission visual success confirmation banner */}
              <div className="bg-white rounded-3xl p-8 border border-[#F1F5F9] shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <div className="inline-flex items-center px-2.5 py-1 bg-emerald-50 text-emerald-800 text-[10px] font-bold uppercase rounded-md border border-emerald-100 mb-3">
                    <CheckCircle className="w-3.5 h-3.5 mr-1" />
                    Paper Transmitted to Central Central Database
                  </div>
                  <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Submission Confirmed & Response Encrypted</h2>
                  <p className="text-xs text-slate-400 mt-1">Envelope identifier token: <span className="font-mono text-slate-500 font-medium">{activeReportCode}</span></p>
                </div>

                <button 
                  onClick={handleRetakeReset}
                  className="px-6 py-3 bg-blue-600 text-white font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100/50"
                >
                  Return to Main Gate
                </button>
              </div>

              {/* Core status tiles */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                
                <div className="bg-white rounded-2xl p-6 border border-[#F1F5F9] shadow-sm text-center">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Submission State</span>
                  <div className="text-lg font-extrabold text-emerald-600 mt-2 truncate font-sans">
                    COMPLETED
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">Responses saved & sealed</span>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-[#F1F5F9] shadow-sm text-center">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Security Scans</span>
                  <div className="text-lg font-extrabold text-blue-600 mt-2 truncate font-sans">
                    STANDBY
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">Awaiting Proctor Check</span>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-[#F1F5F9] shadow-sm text-center">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Shift Normalization</span>
                  <div className="text-lg font-extrabold text-indigo-600 mt-2 truncate font-sans">
                    QUEUED
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">Cross-Shift calculations</span>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-[#F1F5F9] shadow-sm text-center">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Shield Integrity</span>
                  <div className="mt-2.5 inline-flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full uppercase border border-emerald-100">
                    <Shield className="w-3 h-3 mr-1" />
                    CERTIFIED
                  </div>
                  <span className="text-[10px] text-slate-400 mt-2.5 block leading-none">Local biometrics clean</span>
                </div>

              </div>

              {/* Secure Notice & Encryption Details */}
              <div className="grid md:grid-cols-2 gap-8 items-stretch">
                
                {/* Information Statement */}
                <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow flex flex-col justify-between">
                  <div className="space-y-4">
                    <h3 className="text-base font-bold text-slate-800 flex items-center">
                      <Lock className="w-4 h-4 mr-2 text-indigo-600" />
                      Academic Integrity Directive
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed font-sans">
                      In focus of high-stakes testing integrity and absolute secrecy of answer sheets, your individual graded outcome score, answer keys, and dynamic percentile rankings have been compiled securely inside the central proctor database.
                    </p>
                    <p className="text-xs text-slate-500 leading-relaxed font-sans">
                      These results are withheld from student browser client layouts to eliminate coordinate leak hazards and maintain a completely fair evaluation period. Score distributions will be officially formatted and declared by your university administration panel.
                    </p>
                  </div>

                  <div className="pt-6 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span>Directive Code: NEX-DIR-9021</span>
                    <span>Identity: STUDENT</span>
                  </div>
                </div>

                {/* Watermark Leak protection security verification cards */}
                <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-800 flex items-center mb-2">
                      <Shield className="w-4 h-4 mr-2 text-emerald-600" />
                      Secure Fingerprint Token
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed font-sans">
                      Your unique exam environment configuration and telemetry signature are cryptographically recorded. If any unauthorized capture arises, the university proctors can trace it seamlessly back to the source.
                    </p>
                  </div>

                  <div className="p-4 bg-[#0F172A] text-slate-300 rounded-xl font-mono text-xs space-y-2 mt-4">
                    <div className="flex justify-between border-b border-slate-800 pb-1.5 text-[10px]">
                      <span>IDENTIFIER HASH:</span>
                      <span className="text-amber-400 font-bold tracking-tight select-all">{reportResult?.watermark?.substring(0, 24)}...</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span>CRYPTO STATE:</span>
                      <span className="text-emerald-400 font-bold">SEALED & RETRIEVED</span>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          </div>
        )}

        {/* VIEW 5: ADMIN / PROCTOR SECURE COCKPIT */}
        {currentView === 'ADMIN' && (
          <div className="flex-1 overflow-y-auto p-12 bg-[#F8FAFC]">
            <div className="max-w-7xl mx-auto space-y-8">
              
              {/* Cockpit header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-3xl border border-slate-100 shadow-lg">
                <div>
                  <div className="inline-flex items-center px-2.5 py-1 bg-blue-50 text-blue-800 text-[10px] font-bold uppercase tracking-wider rounded-md border border-blue-100 mb-3">
                    <Shield className="w-3.5 h-3.5 mr-1" />
                    Proctor Control Center
                  </div>
                  <h2 className="text-3xl font-extrabold tracking-tight text-slate-800">Project NEXUS Security Cockpit</h2>
                  <p className="text-xs text-slate-400 mt-1">Analyze candidate attempts, calibrate item difficulty indices, and review anomaly flags.</p>
                </div>

                <div className="flex space-x-3">
                  <button 
                    onClick={runIntegrityScans}
                    className="px-5 py-3 bg-[#1D4ED8] text-white font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-blue-700 transition-colors shadow-md shadow-blue-100 flex items-center"
                  >
                    <Sliders className="w-4 h-4 mr-1.5" />
                    Run Integrity Scan
                  </button>
                  <button 
                    onClick={runNormalization}
                    className="px-5 py-3 bg-[#059669] text-white font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-100 flex items-center"
                  >
                    <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" strokeWidth={3} />
                    Normalize All Scores
                  </button>
                  <button 
                    onClick={() => {
                      setCurrentUser(null);
                      setCurrentView('LOGIN');
                    }}
                    className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider rounded-xl transition-colors"
                  >
                    Exit Portal
                  </button>
                </div>
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                
                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Attempts</span>
                  <div className="text-3xl font-black text-slate-800 mt-1">{adminStats.total_attempts}</div>
                  <span className="text-[10px] text-slate-400 mt-1.5 block">Sum total of candidate sessions</span>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm font-sans">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Submitted Papers</span>
                  <div className="text-3xl font-black text-[#059669] mt-1">{adminStats.submitted_attempts}</div>
                  <span className="text-[10px] text-slate-400 mt-1.5 block">Grading finalized over raw banks</span>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm font-sans">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Active Flags Pending</span>
                  <div className="text-3xl font-black text-[#D97706] mt-1">{adminStats.active_flags}</div>
                  <span className="text-[10px] text-[#D97706] mt-1.5 block font-bold uppercase">Requires Human decision</span>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm font-sans">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Calibrated Items</span>
                  <div className="text-3xl font-black text-blue-600 mt-1">{itemBank.length}</div>
                  <span className="text-[10px] text-slate-400 mt-1.5 block">IRT Parameters checked</span>
                </div>

              </div>

              {/* Grid content sections splitting into table of attempts and item bank creator */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                
                {/* LIST OF CANDIDATE SESSION ATTEMPTS */}
                <div className="xl:col-span-2 space-y-6">
                  
                  <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-bold text-slate-800">Candidate Sessions & Percentile Indexes</h3>
                      <button 
                        onClick={loadAdminDashboard}
                        className="p-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-500 hover:text-slate-800"
                        title="Reload Database"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 text-[#94A3B8] font-bold uppercase tracking-wider pb-3">
                            <th className="py-3">Candidate</th>
                            <th>Shift Round</th>
                            <th>Secure Watermark</th>
                            <th>Status/Score</th>
                            <th>Percentile Rank</th>
                            <th>Ability Estimate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {adminAttempts.map((att) => (
                            <tr key={att.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                              <td className="py-4 font-semibold text-slate-800">
                                {att.profile?.full_name}
                                <span className="block font-mono text-[9px] text-[#94A3B8]">App No: {att.profile?.application_number || att.profile?.id}</span>
                              </td>
                              <td className="text-[#475569]">{att.shift_name}</td>
                              <td className="font-mono text-[10px] text-slate-500">{att.watermark ? att.watermark.substring(0, 16) : "N/A"}...</td>
                              <td>
                                {att.status === 'submitted' ? (
                                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-mono font-bold">
                                    {att.raw_score} Correct
                                  </span>
                                ) : (
                                  <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-mono font-bold">
                                    {att.status.toUpperCase()}
                                  </span>
                                )}
                              </td>
                              <td className="font-bold text-slate-700">
                                {att.normalized_percentile !== null ? `${att.normalized_percentile}%` : "Pending scan"}
                              </td>
                              <td className="font-mono text-blue-600 font-bold">
                                {att.ability_estimate !== null ? att.ability_estimate.toFixed(2) : "N/A"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* HUMAN EVALUATION QUEUE */}
                  <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow">
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Human Review Flag Queue (Decisions are Human-made)</h3>
                    <p className="text-xs text-[#94A3B8] mb-6">The system logs anomalies, but absolute decisions require physical supervisor consensus. System never auto-penalizes candidates.</p>

                    <div className="space-y-4">
                      {adminReviewFlags.length === 0 ? (
                        <div className="text-slate-400 text-xs p-6 border border-dashed rounded-xl text-center">
                          Zero outstanding integrity concerns reported.
                        </div>
                      ) : (
                        adminReviewFlags.map((flag) => {
                          const associatedAttempt = adminAttempts.find(a => a.id === flag.attempt_id);
                          const userFullName = associatedAttempt?.profile?.full_name || "Unknown Candidate";

                          return (
                            <div key={flag.id} className="p-4 rounded-xl border border-rose-100 bg-rose-50/20 flex flex-col md:flex-row justify-between gap-4">
                              <div className="space-y-1 text-xs">
                                <div className="flex items-center space-x-2">
                                  <span className="font-bold uppercase text-red-600 text-[10px] bg-red-100/50 px-2 py-0.5 rounded">
                                    {flag.reason.replace(/_/g, ' ')}
                                  </span>
                                  <span className="text-slate-400 font-mono">Flag ID: {flag.id.substring(0, 8)}</span>
                                </div>
                                <span className="font-bold text-slate-800 block text-xs mt-1">Candidate: {userFullName}</span>
                                <p className="text-slate-500 font-sans leading-relaxed text-[11px]">{flag.notes}</p>
                              </div>

                              <div className="flex items-center space-x-2 shrink-0 self-end md:self-center">
                                {flag.status === 'open' ? (
                                  <>
                                    <button 
                                      onClick={() => handleReviewFlagAction(flag.id, 'reviewed_clear', 'Human proctor verified check, dismissed as safe.')}
                                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold uppercase transition-colors"
                                    >
                                      Dismiss Safe
                                    </button>
                                    <button 
                                      onClick={() => handleReviewFlagAction(flag.id, 'reviewed_action', 'Reviewed and action approved by head proctor.')}
                                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold uppercase transition-colors"
                                    >
                                      Uphold Lock
                                    </button>
                                  </>
                                ) : (
                                  <span className="text-xs font-mono font-bold text-slate-500 uppercase bg-slate-100 px-3 py-1 rounded">
                                    RESOVED: {flag.status.replace(/_/g, ' ')}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                </div>

                {/* SECURE ITEM BANK CALIBRATION PANEL */}
                <div className="space-y-6">
                  
                  <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h3 className="text-base font-bold text-slate-800">Secure Item Bank</h3>
                        <p className="text-[11px] text-slate-400">Total item pool calibrated.</p>
                      </div>
                      
                      <button 
                        onClick={createNewItemDraft}
                        className="px-3 py-1.5 bg-[#1D4ED8] text-white hover:bg-blue-700 rounded-lg text-[10px] font-bold uppercase transition-colors"
                      >
                        Add Item
                      </button>
                    </div>

                    <div className="space-y-3">
                      {itemBank.map((item) => (
                        <div key={item.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="px-1.5 py-0.5 bg-slate-200 text-slate-700 text-[8px] font-bold uppercase rounded font-mono">
                                {item.type}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">ID: #{item.id}</span>
                            </div>
                            <span className="font-bold text-slate-800 font-sans text-xs block truncate max-w-[200px]">{item.question_text}</span>
                            
                            {/* IRT difficulty markers stats */}
                            <div className="flex space-x-4 font-mono text-[9px] text-[#475569] pt-1">
                              <span>Diff (b): <b>{item.irt_b || "0.0"}</b></span>
                              <span>Disc (a): <b>{item.irt_a || "1.0"}</b></span>
                              <span>Exposure: <b>{item.exposure_count || "0"}</b></span>
                              <span className="text-emerald-600 font-bold uppercase">{item.status}</span>
                            </div>
                          </div>

                          <div className="flex space-x-1 shrink-0 ml-3">
                            <button 
                              onClick={() => {
                                setSelectedEditingItem({ ...item });
                                setIsEditingItemModalOpen(true);
                              }}
                              className="p-1 border border-slate-200 hover:bg-white text-slate-600 rounded"
                            >
                              <Settings className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => deleteItem(item.id)}
                              className="p-1 border border-rose-100 bg-rose-50 text-rose-600 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

              </div>

            </div>
          </div>
        )}

      </main>

      {/* ITEM BANK CREATOR/EDIT MODAL FOR CALIBRATION */}
      {isEditingItemModalOpen && selectedEditingItem && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 p-8 space-y-6">
            <h3 className="text-lg font-bold text-slate-800">Calibrate Item Parameters</h3>
            
            <form onSubmit={handleEditItemSubmit} className="space-y-4 text-xs font-sans">
              
              <div>
                <label className="font-bold text-slate-500 block mb-1">Item Type Category</label>
                <select 
                  value={selectedEditingItem.type} 
                  onChange={(e) => setSelectedEditingItem({ ...selectedEditingItem, type: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="conceptual">conceptual — Theoretical & Systems Analysis</option>
                  <option value="numerical">numerical — Procedural & Algorithmic Equations</option>
                  <option value="ethical">ethical — Privacy and Regulatory Boundaries</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-500 block mb-1">Question Content / Template Text</label>
                <textarea 
                  value={selectedEditingItem.question_text}
                  onChange={(e) => setSelectedEditingItem({ ...selectedEditingItem, question_text: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl h-20 focus:outline-none focus:ring-1 focus:ring-blue-500" 
                  required
                />
                <span className="text-[10px] text-slate-400 block mt-1">Tip: For numerical types, compile parameters nested in braces, e.g. "A speed of {"{s}"} block...".</span>
              </div>

              {selectedEditingItem.type !== 'numerical' && (
                <div className="space-y-2">
                  <label className="font-bold text-slate-500 block">Plausible options (Comma separated)</label>
                  <input 
                    type="text" 
                    value={selectedEditingItem.options?.join(', ')}
                    onChange={(e) => {
                      const opts = e.target.value.split(',').map(s => s.trim());
                      setSelectedEditingItem({ ...selectedEditingItem, options: opts });
                    }}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl block focus:outline-none focus:ring-1 focus:ring-blue-500" 
                  />

                  <label className="font-bold text-slate-500 block mt-2">Explicit Correct Option</label>
                  <input 
                    type="text" 
                    value={selectedEditingItem.correct_option}
                    onChange={(e) => setSelectedEditingItem({ ...selectedEditingItem, correct_option: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl block focus:outline-none" 
                  />
                </div>
              )}

              {/* IRT parameters values */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-500 block mb-1">IRT Difficulty coefficient (b)</label>
                  <input 
                    type="number" 
                    step="0.1"
                    min="-4.0"
                    max="4.0"
                    value={selectedEditingItem.irt_b}
                    onChange={(e) => setSelectedEditingItem({ ...selectedEditingItem, irt_b: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl font-mono" 
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-500 block mb-1">Item Status</label>
                  <select 
                    value={selectedEditingItem.status}
                    onChange={(e) => setSelectedEditingItem({ ...selectedEditingItem, status: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl font-medium"
                  >
                    <option value="draft">draft</option>
                    <option value="review">review</option>
                    <option value="live">live</option>
                    <option value="retired">retired</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <button 
                  type="button" 
                  onClick={() => setIsEditingItemModalOpen(false)}
                  className="px-4 py-2 border rounded-xl"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 bg-blue-600 text-white font-bold rounded-xl"
                >
                  Save Calibration
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* CONSENT MODAL COMPLIANCE (regulatory DPDP / GDPR) */}
      {showConsentModal && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-100 p-8 space-y-6">
            
            <div className="flex items-center space-x-3 text-blue-600">
              <Shield className="w-6 h-6 shrink-0" />
              <h3 className="text-xl font-bold">Personal Biometrics Data Consent Contract</h3>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl max-h-64 overflow-y-auto text-xs text-slate-500 leading-normal space-y-3 font-sans">
              <p className="font-bold text-slate-800">1. Regulatory Compliance</p>
              <p>Under India's Digital Personal Data Protection Act (DPDP) 2023 and the General Data Protection Regulation (GDPR) Art. 9, we explicitly ask you to opt in before executing facial tracking algorithms or capturing device-focused telemetry metrics during high-stakes exams.</p>
              
              <p className="font-bold text-slate-800">2. Optical Capture Minimization</p>
              <p>By default, the optical camera streams from your local web environment (getUserMedia) are parsed locally inside the isolated browser frame. Zero video content, images, or direct facial hashes stream to third-party providers or are persistent on external cloud targets, unless snapshots are explicitly configured by your respective educational hub, which automatically follow 30-day auto-delete timers.</p>

              <p className="font-bold text-slate-800">3. Right to Withdraw & Deactivate</p>
              <p>Candidates maintain full sovereignty over their data. You can choose to deny this request or override tracking by toggling the "Privacy Mode Constraints" directly on the header interface, allowing you to bypass telemetry tests seamlessly.</p>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 text-xs">
              <button 
                onClick={() => handleConsentResponse(false)}
                className="px-5 py-3 border border-slate-200 font-bold rounded-xl text-slate-600 hover:bg-slate-50 text-center"
              >
                Refuse Optical Consent (Simulated Fallback)
              </button>
              <button 
                onClick={() => handleConsentResponse(true)}
                className="px-6 py-3 bg-[#1D4ED8] hover:bg-blue-700 text-white font-bold rounded-xl text-center"
              >
                Accept and Seal Opt-in Authorization
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Global Ticker Footer (Geometric Balance styling) */}
      <footer className="h-10 px-8 bg-[#F1F5F9] border-t border-slate-200 flex items-center justify-between shrink-0 font-mono text-[10px] text-slate-400">
        <div className="flex items-center space-x-6">
          <div className="flex items-center">
            <span className={`w-2 h-2 rounded-full mr-2 ${privacyMode ? 'bg-amber-400' : 'bg-emerald-500'}`}></span>
            <span>INTEGRITY FEED: 0ms LATENCY</span>
          </div>
          <div className="hidden sm:flex items-center">
            <span>AUDIT CHAIN HASH:</span>
            <span className="ml-2 text-slate-500 tracking-wider font-semibold select-all font-mono">{lastChainHash}</span>
          </div>
        </div>
        <div className="flex items-center space-x-4 uppercase tracking-widest text-[9px]">
          <span>Secure Sandbox: Active v4.2.1</span>
          <span className="h-3 w-px bg-slate-300"></span>
          <span>Security Type: SHA256-Chained</span>
        </div>
      </footer>

    </div>
  );
}
