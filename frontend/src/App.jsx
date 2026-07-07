import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { Upload, Send, MessageSquare, Mail, CheckCircle, AlertCircle, Loader2, Wand2, Eye, EyeOff, Phone, User, Layers, ChevronDown, Sparkles, Calendar, X, Lock, LogOut, Plus, Trash2, Edit, ArrowLeft, Download, Building2, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8000/api'
  : 'https://api.automation.cubemoons.com/api';

const formatExactDate = (dateStr) => {
  if (!dateStr || dateStr.toLowerCase().includes("pending")) return "Pending";
  try {
    const cleanedStr = dateStr.replace(/-/g, '/');
    let date = new Date(cleanedStr);
    let rawTimePart = "";

    // Extract time from raw string if native parsing misses it or fails
    const timeMatch = dateStr.match(/(\d{1,2}):(\d{2}):?(\d{2})?\s*(AM|PM)?/i);
    if (timeMatch) {
      const [_, h, m, s, ap] = timeMatch;
      rawTimePart = `${h.padStart(2, '0')}:${m}${ap ? ap.toUpperCase() : ''}`;
    }
    
    if (isNaN(date.getTime())) {
      const match = cleanedStr.match(/^(\d{4})\/(\d{2})\/(\d{2})/);
      if (match) {
        let [_, year, month, day] = match;
        year = parseInt(year);
        month = parseInt(month) - 1;
        day = parseInt(day);
        date = new Date(year, month, day);
      }
    }
    
    if (isNaN(date.getTime())) return dateStr;
    
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    
    let timeStr = rawTimePart;
    if (!timeStr) {
      let hours = date.getHours();
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      timeStr = `${hours.toString().padStart(2, '0')}:${minutes}${ampm}`;
    }
    
    return `${day} ${month} ${year}, ${timeStr}`;
  } catch (e) {
    return dateStr;
  }
};

const getLogDateObject = (dateStr) => {
  if (!dateStr || dateStr.toLowerCase().includes("pending")) return null;
  try {
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
    }
    const cleanedStr = dateStr.replace(/-/g, '/').split(',')[0].trim();
    const d = new Date(cleanedStr);
    if (!isNaN(d.getTime())) {
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }
  } catch (e) {
    // ignore
  }
  return null;
};

function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('cube_campaign_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const [uploadData, setUploadData] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [platform, setPlatform] = useState('whatsapp'); // whatsapp, email, both
  const [whatsappMsg, setWhatsappMsg] = useState('Hi {name}, how are you?');
  const [emailSubject, setEmailSubject] = useState('Important Update');
  const [emailBody, setEmailBody] = useState('Hi {name},\n\nWe have an update for you.');
  const [mapping, setMapping] = useState({});
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [campaignId, setCampaignId] = useState(null);
  const [campaignResults, setCampaignResults] = useState([]);
  const [campaignList, setCampaignList] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState('all');
  const [startSno, setStartSno] = useState('');
  const [endSno, setEndSno] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [selectedDate, setSelectedDate] = useState('');
  const dateInputRef = useRef(null);

  // Custom date range states
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);
  const [dateFilterType, setDateFilterType] = useState('single'); // 'single' or 'range'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const datePopoverRef = useRef(null);

  // New Filters States and Refs
  const [selectedCreator, setSelectedCreator] = useState('all');
  const [isCreatorDropdownOpen, setIsCreatorDropdownOpen] = useState(false);
  const creatorDropdownRef = useRef(null);

  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [isPlatformDropdownOpen, setIsPlatformDropdownOpen] = useState(false);
  const platformDropdownRef = useRef(null);

  // Subscription and Search Filters States and Refs
  const [selectedSubscription, setSelectedSubscription] = useState('all');
  const [isSubscriptionDropdownOpen, setIsSubscriptionDropdownOpen] = useState(false);
  const subscriptionDropdownRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [localSearchQuery, setLocalSearchQuery] = useState('');

  // Debounce search query updates to avoid lag on typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(localSearchQuery);
    }, 150);
    return () => clearTimeout(timer);
  }, [localSearchQuery]);

  // Status Filter States and Refs
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef(null);

  const [emailsSentToday, setEmailsSentToday] = useState(0);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef(null);

  // View control state
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard' or 'users'

  // User Management State
  const [usersList, setUsersList] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [formId, setFormId] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState('User');
  const [deleteConfirmUser, setDeleteConfirmUser] = useState(null);

  // Axios Interceptors for Auth token injection and automatic 401 handling
  useEffect(() => {
    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        if (user && user.token) {
          config.headers.Authorization = `Bearer ${user.token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 401) {
          // Clear credentials automatically
          setUser(null);
          localStorage.removeItem('cube_campaign_user');
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, [user]);

  const getNextUserId = (list) => {
    if (!list || list.length === 0) return 'CUB001';
    let maxNum = 0;
    list.forEach(u => {
      const match = (u.id || '').match(/CUB(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      } else {
        const num = parseInt(u.id, 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
    return `CUB${String(maxNum + 1).padStart(3, '0')}`;
  };

  const fetchUsers = async () => {
    if (!user || user.role !== 'Admin') return;
    setIsLoadingUsers(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/users`);
      setUsersList(response.data);
      if (!editingUserId) {
        setFormId(getNextUserId(response.data));
      }
    } catch (error) {
      console.error("Failed to fetch users list", error);
      showToast("Failed to load users list", "error");
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (user && user.role === 'Admin') {
      fetchUsers();
    }
  }, [user]);

  const handleAddOrUpdateUser = async (e) => {
    e.preventDefault();
    if (!formId.trim() || !formUsername.trim() || !formPassword.trim()) {
      showToast("Please fill all fields.", "error");
      return;
    }

    try {
      if (editingUserId) {
        await axios.put(`${API_BASE_URL}/users/${editingUserId}`, {
          username: formUsername.trim(),
          password: formPassword.trim(),
          role: formRole
        });
        showToast("User updated successfully", "success");
      } else {
        await axios.post(`${API_BASE_URL}/users`, {
          id: formId.trim(),
          username: formUsername.trim(),
          password: formPassword.trim(),
          role: formRole
        });
        showToast("User added successfully", "success");
      }
      resetUserForm();
      fetchUsers();
    } catch (error) {
      console.error("Failed to save user", error);
      const errMsg = error.response?.data?.detail || "Failed to save user details";
      showToast(errMsg, "error");
    }
  };

  const resetUserForm = () => {
    setEditingUserId(null);
    setFormId(getNextUserId(usersList));
    setFormUsername('');
    setFormPassword('');
    setFormRole('User');
  };

  const handleEditClick = (u) => {
    setEditingUserId(u.id);
    setFormId(u.id);
    setFormUsername(u.username);
    setFormPassword(u.password);
    setFormRole(u.role);
  };

  const handleDeleteUser = async (userId) => {
    try {
      await axios.delete(`${API_BASE_URL}/users/${userId}`);
      showToast("User deleted successfully", "success");
      if (editingUserId === userId) {
        resetUserForm();
      }
      fetchUsers();
    } catch (error) {
      console.error("Failed to delete user", error);
      const errMsg = error.response?.data?.detail || "Failed to delete user";
      showToast(errMsg, "error");
    }
  };


  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
      if (creatorDropdownRef.current && !creatorDropdownRef.current.contains(event.target)) {
        setIsCreatorDropdownOpen(false);
      }
      if (platformDropdownRef.current && !platformDropdownRef.current.contains(event.target)) {
        setIsPlatformDropdownOpen(false);
      }
      if (subscriptionDropdownRef.current && !subscriptionDropdownRef.current.contains(event.target)) {
        setIsSubscriptionDropdownOpen(false);
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target)) {
        setIsStatusDropdownOpen(false);
      }
      if (datePopoverRef.current && !datePopoverRef.current.contains(event.target)) {
        setIsDatePopoverOpen(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginUsername.trim() || !loginPassword.trim()) {
      setLoginError("Please enter User Name and Password.");
      return;
    }
    setIsLoggingIn(true);
    setLoginError('');
    try {
      const response = await axios.post(`${API_BASE_URL}/login`, {
        username: loginUsername.trim(),
        password: loginPassword.trim()
      });
      const userData = response.data;
      setUser(userData);
      setCurrentView('dashboard');
      localStorage.setItem('cube_campaign_user', JSON.stringify(userData));
      showToast(`Welcome back, ${userData.username}!`, 'success');
      setLoginUsername('');
      setLoginPassword('');
    } catch (err) {
      console.error("Login failed", err);
      const errMsg = err.response?.data?.detail || "Invalid User Name or Password. Please try again.";
      setLoginError(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('cube_campaign_user');
    setCurrentView('dashboard');
    showToast("Logged out successfully.", "success");
  };

  const fetchCampaigns = async () => {
    try {
      const spreadsheetParam = spreadsheetId ? `?spreadsheet_id=${spreadsheetId}` : '';
      const response = await axios.get(`${API_BASE_URL}/campaigns${spreadsheetParam}`);
      setCampaignList(response.data);
    } catch (error) {
      console.error("Failed to fetch campaign list", error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchCampaigns();
    }
  }, [spreadsheetId, user]);

  useEffect(() => {
    if (!user) {
      setIsLoadingLogs(false);
      return;
    }

    const fetchLogs = async () => {
      setIsLoadingLogs(true);
      try {
        const spreadsheetParam = spreadsheetId ? `?spreadsheet_id=${spreadsheetId}` : '';
        const endpoint = selectedCampaign === 'all'
          ? `${API_BASE_URL}/campaign/all/status${spreadsheetParam}`
          : `${API_BASE_URL}/campaign/${selectedCampaign}/status${spreadsheetParam}`;
        const response = await axios.get(endpoint, { timeout: 10000 });
        setCampaignResults(response.data);

        // Fetch daily emails sent count
        const countResponse = await axios.get(`${API_BASE_URL}/campaign/emails-sent-today${spreadsheetParam}`, { timeout: 10000 });
        setEmailsSentToday(countResponse.data.emails_sent_today);
      } catch (error) {
        console.error("Status polling failed", error);
      } finally {
        setIsLoadingLogs(false);
      }
    };

    // Fetch immediately on mount/filter change
    fetchLogs();
    // Then poll every 5s (reduced from 2s to avoid Google Sheets API quota issues)
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [selectedCampaign, spreadsheetId, user]);

  const processFile = async (selectedFile) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await axios.post(`${API_BASE_URL}/upload`, formData);
      setUploadData(response.data);
      setMapping(response.data.detected_mapping);
    } catch (error) {
      console.error("Upload failed", error);
      showToast("Failed to upload and detect columns.", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = (e) => processFile(e.target.files[0]);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) processFile(droppedFile);
  };

  const handleStartCampaign = async () => {
    if (!spreadsheetId && !file) {
      showToast("Please enter a Google Sheet ID or upload a local file first.", "error");
      return;
    }
    setIsStarting(true);
    setCampaignResults([]); // Clear old results
    const formData = new FormData();
    formData.append('platform', platform);
    formData.append('spreadsheet_id', spreadsheetId || '');
    formData.append('whatsapp_message', whatsappMsg);
    formData.append('email_subject', emailSubject);
    formData.append('email_body', emailBody);
    formData.append('mapping', JSON.stringify(mapping));
    formData.append('start_sno', startSno);
    formData.append('end_sno', endSno);
    if (file) {
      formData.append('file', file);
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/start-campaign`, formData);
      setCampaignId(response.data.campaign_id);
      setSelectedCampaign(response.data.campaign_id);
      showToast(response.data.message, "success");
      fetchCampaigns();
    } catch (error) {
      console.error("Campaign start failed", error);
      const errorMsg = error.response?.data?.detail || "Failed to start campaign.";
      showToast(errorMsg, "error");
    } finally {
      setIsStarting(false);
    }
  };


  const handleRewrite = async (type) => {
    try {
      const content = type === 'whatsapp' ? whatsappMsg : emailBody;
      const formData = new FormData();
      formData.append('message', content);
      formData.append('tone', 'professional');
      const response = await axios.post(`${API_BASE_URL}/rewrite`, formData);
      if (type === 'whatsapp') setWhatsappMsg(response.data.rewritten);
      else setEmailBody(response.data.rewritten);
    } catch (error) {
      console.error("Rewrite failed", error);
    }
  };

  const handleExportCampaign = async () => {
    if (filteredResults.length === 0) {
      showToast("No logs to export.", "error");
      return;
    }
    try {
      showToast("Preparing Excel sheet...", "success");
      const response = await axios.post(
        `${API_BASE_URL}/campaign/export-custom`,
        {
          campaign_id: selectedCampaign === 'all' ? 'all_campaigns' : selectedCampaign,
          results: filteredResults
        },
        { responseType: 'blob' }
      );
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const filename = selectedCampaign === 'all' 
        ? 'all_campaigns_logs.xlsx' 
        : `${selectedCampaign}_logs.xlsx`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      showToast("Logs downloaded successfully!", "success");
    } catch (error) {
      console.error("Export failed", error);
      showToast("Failed to export logs to Excel.", "error");
    }
  };

  const getLatestRange = () => {
    if (!campaignList || campaignList.length === 0) return null;
    const latestCampaign = campaignList[0].id || campaignList[0];
    const match = String(latestCampaign).match(/\(([^)]+)\)/);
    return match ? match[1] : 'All';
  };
  const latestRange = getLatestRange();

  const uniqueCreators = ['all', ...new Set(campaignResults.map(r => r.generated_by).filter(Boolean))];

  // Accumulate campaign ID to Date string mapping dynamically
  const [campaignDates, setCampaignDates] = useState({});

  useEffect(() => {
    if (campaignResults.length > 0) {
      setCampaignDates(prev => {
        const next = { ...prev };
        let updated = false;
        campaignResults.forEach(r => {
          if (!r.sent_time || !r.campaign_id) return;
          // Extract the date part (e.g. before comma/time, like "27 June 2026")
          const datePart = r.sent_time.split(",")[0].trim();
          if (next[r.campaign_id] !== datePart) {
            next[r.campaign_id] = datePart;
            updated = true;
          }
        });
        return updated ? next : prev;
      });
    }
  }, [campaignResults]);

  const getDateLabelForCampaign = (cid) => {
    if (campaignDates[cid]) {
      return ` — ${campaignDates[cid]}`;
    }
    return '';
  };

  const filteredResults = useMemo(() => {
    return campaignResults.filter((result) => {
      if (dateFilterType === 'single') {
        if (selectedDate) {
          const logDate = getLogDateObject(result.sent_time);
          if (!logDate) return false;
          const parts = selectedDate.split('-');
          const targetDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          if (logDate.getTime() !== targetDate.getTime()) {
            return false;
          }
        }
      } else if (dateFilterType === 'range') {
        if (startDate || endDate) {
          const logDate = getLogDateObject(result.sent_time);
          if (!logDate) return false;
          if (startDate) {
            const parts = startDate.split('-');
            const startTarget = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
            if (logDate.getTime() < startTarget.getTime()) {
              return false;
            }
          }
          if (endDate) {
            const parts = endDate.split('-');
            const endTarget = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
            if (logDate.getTime() > endTarget.getTime()) {
              return false;
            }
          }
        }
      }
      if (selectedCreator !== 'all') {
        if (!result.generated_by || result.generated_by !== selectedCreator) {
          return false;
        }
      }
      if (selectedPlatform !== 'all') {
        if (!result.type || result.type.toLowerCase() !== selectedPlatform.toLowerCase()) {
          return false;
        }
      }
      if (selectedSubscription !== 'all') {
        const subVal = result.subscription || 'Yes';
        if (subVal !== selectedSubscription) {
          return false;
        }
      }
      if (selectedStatus !== 'all') {
        const statusVal = result.status;
        if (selectedStatus === 'Failed') {
          if (statusVal === 'Seen' || statusVal === 'Sent') {
            return false;
          }
        } else {
          if (statusVal !== selectedStatus) {
            return false;
          }
        }
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const name = (result.name || '').toLowerCase();
        const company = (result.company || '').toLowerCase();
        const contact = (result.phone || result.email || '').toLowerCase();
        const campaignId = (result.campaign_id || '').toLowerCase();
        const unsubReason = (result.unsub_reason || '').toLowerCase();
        const unsubOther = (result.unsub_other || '').toLowerCase();

        if (
          !name.includes(query) &&
          !company.includes(query) &&
          !contact.includes(query) &&
          !campaignId.includes(query) &&
          !unsubReason.includes(query) &&
          !unsubOther.includes(query)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [campaignResults, selectedDate, dateFilterType, startDate, endDate, selectedCreator, selectedPlatform, selectedSubscription, selectedStatus, searchQuery]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50/50 p-4 relative overflow-hidden">
        {/* Background Decorative Blurs */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-secondary/5 rounded-full blur-[120px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full max-w-md glass p-8 space-y-6 relative z-10"
        >
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <img src="/logo.png" alt="Cubemoons Logo" className="h-16 w-auto object-contain" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-xs font-semibold text-primary">
              <Sparkles size={12} className="text-secondary animate-pulse" />
              <span>Cube AI</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary via-secondary to-accent pt-1 pb-1">
              Campaign Console
            </h1>
            <p className="text-slate-400 text-xs font-medium">Log in to manage your custom messaging campaigns</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="p-3 rounded-xl border border-rose-100 bg-rose-50/50 text-rose-600 text-xs font-semibold flex items-center gap-2"
              >
                <AlertCircle size={14} className="shrink-0" />
                <span>{loginError}</span>
              </motion.div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="login-username" className="text-xs font-bold uppercase tracking-wider text-slate-500">User Name</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                  <User size={16} />
                </span>
                <input
                  id="login-username"
                  type="text"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  className="w-full input-field"
                  style={{ paddingLeft: '2.5rem', paddingRight: '1rem' }}
                  placeholder="Enter User Name"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="login-password" className="text-xs font-bold uppercase tracking-wider text-slate-500">Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                  <Lock size={16} />
                </span>
                 <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full input-field"
                  style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                  placeholder="Enter Password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 btn-primary mt-2 cursor-pointer shadow-md"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="animate-spin w-4 h-4" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <Lock size={14} />
                  <span>Log In</span>
                </>
              )}
            </button>
          </form>
        </motion.div>

        {/* Global Toast Rendering */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl backdrop-blur-md border border-white/20 transition-all max-w-sm
                ${toast.type === 'error'
                  ? 'bg-rose-50/90 text-rose-800 border-rose-100 shadow-rose-100/35'
                  : 'bg-emerald-50/90 text-emerald-800 border-emerald-100 shadow-emerald-100/35'
                }`}
            >
              {toast.type === 'error' ? (
                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
              ) : (
                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
              )}
              <p className="text-xs font-semibold">{toast.message}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (user && user.role === 'Admin' && currentView === 'users') {
    return (
      <div className="max-w-6xl mx-auto p-4 md:py-6 md:px-12 min-h-screen flex flex-col">
        {/* Top Session Bar */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <button
            onClick={() => {
              setCurrentView('dashboard');
              resetUserForm();
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 hover:bg-slate-100 text-slate-600 hover:text-slate-800 rounded-xl font-bold cursor-pointer transition-all text-xs border border-transparent hover:border-slate-200/60"
          >
            <ArrowLeft size={14} />
            <span>Back to Dashboard</span>
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-4 py-2 bg-rose-50 border border-rose-100 hover:bg-rose-100 text-rose-600 rounded-xl font-bold cursor-pointer transition-all shadow-sm text-xs"
          >
            <LogOut size={14} />
            <span>Logout</span>
          </button>
        </div>

        {/* Content: User Management */}
        <div className="flex-1 mt-4">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-primary/10 border border-primary/20 rounded-xl">
              <User className="text-primary w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-800">User Management</h2>
              <p className="text-xs text-slate-400 mt-0.5">Manage user credentials and roles in the database sheet</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Users Table */}
            <div className="lg:col-span-2 overflow-auto max-h-[500px] rounded-xl border border-slate-100 bg-white scrollbar-thin shadow-sm">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/75">
                    <th className="sticky top-0 bg-slate-50/90 backdrop-blur-sm z-10 p-4 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">ID</th>
                    <th className="sticky top-0 bg-slate-50/90 backdrop-blur-sm z-10 p-4 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">User Name</th>
                    <th className="sticky top-0 bg-slate-50/90 backdrop-blur-sm z-10 p-4 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">Password</th>
                    <th className="sticky top-0 bg-slate-50/90 backdrop-blur-sm z-10 p-4 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">Role</th>
                    <th className="sticky top-0 bg-slate-50/90 backdrop-blur-sm z-10 p-4 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {isLoadingUsers ? (
                    <tr>
                      <td colSpan="5" className="py-16 text-center text-slate-400">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="animate-spin w-5 h-5 text-primary" />
                          <span className="text-sm font-medium">Fetching users...</span>
                        </div>
                      </td>
                    </tr>
                  ) : usersList.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-16 text-center text-slate-400 text-sm">
                        No users found.
                      </td>
                    </tr>
                  ) : (
                    usersList.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 font-semibold text-slate-700">{u.id}</td>
                        <td className="p-4 text-slate-600 font-medium">{u.username}</td>
                        <td className="p-4 text-slate-400 font-mono text-xs select-all">{u.password}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${u.role === 'Admin' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEditClick(u)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                              title="Edit User"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmUser(u)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                              title="Delete User"
                              disabled={u.username.toLowerCase() === 'admin' || u.username === user.username}
                              style={{ opacity: (u.username.toLowerCase() === 'admin' || u.username === user.username) ? 0.3 : 1 }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Form Card */}
            <div className="bg-slate-50/75 border border-slate-100 rounded-2xl p-5 md:p-6 space-y-4 shadow-sm h-fit">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200/50 pb-2">
                {editingUserId ? 'Edit User Details' : 'Add New User'}
              </h3>
              <form onSubmit={handleAddOrUpdateUser} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">User ID</label>
                  <input
                    type="text"
                    value={formId}
                    onChange={(e) => setFormId(e.target.value)}
                    disabled={true}
                    placeholder="Auto-generated"
                    className="w-full input-field px-3 py-2 text-xs placeholder-slate-400 disabled:opacity-50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">User Name</label>
                  <input
                    type="text"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    placeholder="Enter Username"
                    className="w-full input-field px-3 py-2 text-xs placeholder-slate-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Password</label>
                  <input
                    type="text"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="Enter Password"
                    className="w-full input-field px-3 py-2 text-xs placeholder-slate-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Role</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    className="w-full input-field px-3 py-2 text-xs transition-all cursor-pointer"
                  >
                    <option value="User">User</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-2 px-3 bg-gradient-to-r from-primary to-secondary text-white rounded-xl text-xs font-bold hover:brightness-105 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-primary/10"
                  >
                    <Plus size={12} />
                    <span>{editingUserId ? 'Update Details' : 'Add User'}</span>
                  </button>
                  {editingUserId && (
                    <button
                      type="button"
                      onClick={resetUserForm}
                      className="py-2 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>

          </div>   {/* closes grid */}
        </div>     {/* closes flex-1 */}

        {/* Custom Confirmation Modal */}
        <AnimatePresence>
          {deleteConfirmUser && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setDeleteConfirmUser(null)}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              />

              {/* Modal Card */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ type: "spring", duration: 0.3 }}
                className="bg-white border border-slate-100 rounded-2xl p-6 max-w-sm w-full relative z-10 shadow-2xl space-y-4 text-center"
              >
                <div className="mx-auto w-12 h-12 bg-rose-50 border border-rose-100 text-rose-600 rounded-full flex items-center justify-center">
                  <Trash2 className="w-5 h-5" />
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-md font-bold text-slate-800">Delete User Account</h3>
                  <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                    Are you sure you want to delete user <strong className="text-slate-700">{deleteConfirmUser.username}</strong> (ID: {deleteConfirmUser.id})? This action cannot be undone.
                  </p>
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    onClick={() => setDeleteConfirmUser(null)}
                    className="flex-1 py-2 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      handleDeleteUser(deleteConfirmUser.id);
                      setDeleteConfirmUser(null);
                    }}
                    className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md shadow-rose-600/10"
                  >
                    Yes, Delete
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl backdrop-blur-md border border-white/20 transition-all max-w-sm
                ${toast.type === 'error'
                  ? 'bg-rose-50/90 text-rose-800 border-rose-100 shadow-rose-100/35'
                  : 'bg-emerald-50/90 text-emerald-800 border-emerald-100 shadow-emerald-100/35'
                }`}
            >
              {toast.type === 'error' ? (
                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
              ) : (
                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
              )}
              <p className="text-xs font-semibold">{toast.message}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/20">
      {/* Navigation Bar */}
      <nav className="w-full bg-white/80 backdrop-blur-md border-b border-slate-200/50 sticky top-0 z-50 py-2 px-6 md:px-12 flex items-center justify-between shadow-sm">
        {/* Left Side: Logo & Brand Name */}
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="Cubemoons Logo" className="h-9 w-auto object-contain hover:scale-105 transition-transform duration-200" />
          <span className="text-sm font-black tracking-tight text-slate-700 bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary select-none">
            Cube AI
          </span>
        </div>

        {/* Right Side: Profile Dropdown */}
        <div ref={profileMenuRef} className="relative">
          <button
            onClick={() => {
              setShowProfileMenu(!showProfileMenu);
            }}
            className="flex items-center gap-2 group cursor-pointer focus:outline-none bg-slate-50/60 hover:bg-slate-100/80 px-2.5 py-1.5 rounded-xl border border-slate-100/80 transition-all"
            title="User Profile"
          >
            {/* Circular Profile Icon with First Letter */}
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-secondary text-white font-bold text-sm flex items-center justify-center shadow-md shadow-primary/10 transition-all border-2 border-white select-none">
              {user.username ? user.username.charAt(0).toUpperCase() : 'U'}
            </div>
            {/* Username */}
            <span className="text-xs font-bold text-slate-600 group-hover:text-slate-900 transition-colors select-none">
              {user.username}
            </span>
          </button>

          {/* Small Dropdown Menu for Logout */}
          <AnimatePresence>
            {showProfileMenu && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="absolute right-0 mt-2 w-36 bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-xl shadow-xl p-1 z-50 origin-top-right"
              >
                <button
                  onClick={() => {
                    handleLogout();
                    setShowProfileMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer text-left rounded-lg"
                >
                  <LogOut size={14} className="stroke-[2.5]" />
                  <span>Logout</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="max-w-6xl w-full mx-auto p-4 md:py-6 md:px-12 flex-1">

      <header className="mb-6 md:mb-8 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-xs font-semibold text-primary mb-3"
        >
          <Sparkles size={12} className="text-secondary animate-pulse" />
          <span>Cube AI campaign console</span>
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary via-secondary to-accent pt-1 pb-2 mb-1"
        >
          AI Bulk Messaging System
        </motion.h1>
        <p className="text-slate-500 text-sm md:text-md max-w-2xl mx-auto font-medium">Smart AI integration for seamless WhatsApp and Email campaigns</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
        {/* Step 1: Upload */}
        <section className="glass p-4 md:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 border border-primary/20 rounded-xl">
                <Upload className="text-primary w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-slate-800">1. Data Source</h2>
            </div>
            <div className={`flex items-center gap-1.5 text-xs font-bold transition-colors
              ${emailsSentToday >= 1000
                ? 'text-rose-600 animate-pulse'
                : 'text-emerald-600'
              }`}>
              <Mail size={12} />
              <span>Daily Limit: {emailsSentToday}/1000</span>
            </div>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Sheet ID</label>
                {spreadsheetId && (
                  <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                    Connected
                  </span>
                )}
              </div>
              <input
                type="text"
                value={spreadsheetId}
                onChange={(e) => setSpreadsheetId(e.target.value)}
                className="w-full input-field"
                placeholder="e.g. 1R3tBUcQKzMX-________________________________0"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">S.No Range Filtering (Optional)</label>
                {latestRange && (
                  <span className="text-[10px] text-primary font-bold bg-primary/5 px-2 py-0.5 rounded border border-primary/15">
                    Last Sent Range: {latestRange}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Start S.No (From)</label>
                  <input
                    type="number"
                    min="1"
                    value={startSno}
                    onChange={(e) => setStartSno(e.target.value)}
                    className="w-full input-field focus:ring-1 focus:ring-primary/20"
                    placeholder="e.g. 20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">End S.No (To)</label>
                  <input
                    type="number"
                    min="1"
                    value={endSno}
                    onChange={(e) => setEndSno(e.target.value)}
                    className="w-full input-field focus:ring-1 focus:ring-primary/20"
                    placeholder="e.g. 100"
                  />
                </div>
              </div>
            </div>

            {/* Hidden real file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* Clickable Upload Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-6 md:p-8 text-center transition-all cursor-pointer select-none
                ${file
                  ? 'border-emerald-400/50 bg-emerald-50/30'
                  : isDragging
                    ? 'border-primary bg-primary/5 scale-[1.01]'
                    : 'border-slate-200 hover:border-primary/60 hover:bg-blue-50/30'
                }`}
            >
              <div className="space-y-4 pointer-events-none">
                <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center transition-all
                  ${file
                    ? 'bg-emerald-100 text-emerald-600'
                    : isDragging
                      ? 'bg-primary/10 text-primary scale-110'
                      : 'bg-slate-100 text-slate-400'
                  }`}>
                  {isUploading ? (
                    <Loader2 className="animate-spin" />
                  ) : file ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <Upload className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <p className={`text-sm font-semibold ${file ? 'text-emerald-600' : isDragging ? 'text-primary' : 'text-slate-700'
                    }`}>
                    {isUploading
                      ? 'Processing file...'
                      : file
                        ? file.name
                        : isDragging
                          ? 'Drop your file here!'
                          : 'Upload CSV or Excel file'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {file
                      ? `${(file.size / 1024).toFixed(1)} KB · Click to change`
                      : 'Drag & drop or click to browse · .csv, .xlsx supported'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {uploadData && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3 pt-4 border-t border-slate-100"
              >
                <div className="flex items-center gap-2">
                  <Layers size={14} className="text-slate-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">AI Detected Mappings</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Object.entries(mapping).map(([key, value]) => {
                    const hasValue = !!value;
                    return (
                      <div key={key} className={`p-2.5 rounded-xl border transition-all ${hasValue ? 'bg-white border-slate-100 shadow-sm shadow-slate-100/50' : 'bg-rose-50/30 border-rose-100'}`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          {key === 'name' ? (
                            <User size={11} className="text-slate-400" />
                          ) : key === 'phone' ? (
                            <Phone size={11} className="text-slate-400" />
                          ) : key === 'email' ? (
                            <Mail size={11} className="text-slate-400" />
                          ) : key === 'company' ? (
                            <Building2 size={11} className="text-slate-400" />
                          ) : (
                            <MessageSquare size={11} className="text-slate-400" />
                          )}
                          <p className="text-[10px] font-bold text-slate-400 capitalize truncate">{key}</p>
                        </div>
                        <p className={`text-xs font-bold truncate ${hasValue ? 'text-primary' : 'text-rose-500'}`}>
                          {value || "Missing"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Step 2: Compose */}
        <section className="glass p-4 md:p-6 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-secondary/10 border border-secondary/20 rounded-xl">
              <MessageSquare className="text-secondary w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-slate-800">2. Compose Campaign</h2>
          </div>

          <div className="flex gap-2 p-1 bg-slate-100 border border-slate-200/60 rounded-xl relative">
            {['whatsapp', 'email', 'both'].map((p) => {
              const isActive = platform === p;
              return (
                <button
                  key={p}
                  onClick={() => setPlatform(p)}
                  className={`relative flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors duration-200 z-10 cursor-pointer ${isActive ? 'text-white' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-gradient-to-r from-primary to-secondary rounded-lg -z-10 shadow-sm"
                      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                    />
                  )}
                  {p}
                </button>
              );
            })}
          </div>

          <div className="space-y-4">
            {(platform === 'whatsapp' || platform === 'both') && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">WhatsApp Message Template</label>
                  <button
                    onClick={() => handleRewrite('whatsapp')}
                    className="text-[11px] flex items-center gap-1.5 px-2.5 py-1 bg-primary/5 border border-primary/15 rounded-lg text-primary hover:bg-primary/10 transition-all cursor-pointer font-semibold"
                  >
                    <Wand2 size={11} />
                    <span>AI Rewrite</span>
                  </button>
                </div>
                <textarea
                  value={whatsappMsg}
                  onChange={(e) => setWhatsappMsg(e.target.value)}
                  className="w-full h-64 input-field resize-none focus:ring-1 focus:ring-primary/20"
                  placeholder="Use {name} or other column names for personalization (e.g. Hi {name}, how are you?)"
                />
              </div>
            )}

            {(platform === 'email' || platform === 'both') && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Email Subject</label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="w-full input-field"
                    placeholder="Enter campaign subject"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Email Body Template</label>
                    <button
                      onClick={() => handleRewrite('email')}
                      className="text-[11px] flex items-center gap-1.5 px-2.5 py-1 bg-primary/5 border border-primary/15 rounded-lg text-primary hover:bg-primary/10 transition-all cursor-pointer font-semibold"
                    >
                      <Wand2 size={11} />
                      <span>AI Rewrite</span>
                    </button>
                  </div>
                  <textarea
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    className="w-full h-64 input-field resize-none focus:ring-1 focus:ring-primary/20"
                    placeholder="Use {name} or other variables. HTML formatting is supported."
                  />
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleStartCampaign}
            disabled={isStarting || (!uploadData && !spreadsheetId) || (emailsSentToday >= 1000)}
            className={`w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${isStarting || (!uploadData && !spreadsheetId) || (emailsSentToday >= 1000) ? 'bg-slate-100 text-slate-400 border border-slate-200/50 cursor-not-allowed' : 'btn-primary'}`}
          >
            {isStarting ? (
              <>
                <Loader2 className="animate-spin w-5 h-5" />
                <span>Initializing Campaign...</span>
              </>
            ) : (
              <>
                <Send size={16} />
                <span>Launch Campaign</span>
              </>
            )}
          </button>
        </section>
      </div>
      </div> {/* Close the max-w-6xl main content wrapper */}

      {/* Progress Section (Full screen width) */}
      <div className="w-full px-4 md:px-8 pb-12 flex-1">
      <section className="mt-8 glass p-5 md:p-8 w-full max-w-none">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100/80 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 border border-primary/20 rounded-xl">
              <CheckCircle className="text-primary w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-slate-800">Campaign Logs</h2>
                {latestRange && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-primary/5 text-primary border border-primary/20">
                    Last Sent Range: {latestRange}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Real-time status updates (2s polling active)</p>
            </div>
          </div>
          {/* Export Excel (Row 1 right side) */}
          <button
            type="button"
            onClick={handleExportCampaign}
            disabled={filteredResults.length === 0}
            className={`py-2 px-3.5 text-xs flex items-center gap-1.5 shadow-sm rounded-xl cursor-pointer transition-all
              ${filteredResults.length === 0 
                ? 'bg-slate-100 border border-slate-200/50 text-slate-400 cursor-not-allowed' 
                : 'btn-primary'}`}
            title="Export Logs to Excel"
          >
            <Download size={14} />
            <span>Export Excel</span>
          </button>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          {/* Search Bar (Row 2 left side) */}
          <div className="relative flex-grow max-w-md min-w-[200px] w-full">
            <input
              type="text"
              value={localSearchQuery}
              onChange={(e) => setLocalSearchQuery(e.target.value)}
              placeholder="Search recipient, address, company..."
              className="w-full bg-white border border-slate-200/80 hover:border-slate-300 rounded-xl pl-9 pr-8 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-primary/60 transition-all shadow-sm"
            />
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
              <Search size={14} />
            </span>
            {localSearchQuery && (
              <button
                type="button"
                onClick={() => {
                  setLocalSearchQuery('');
                  setSearchQuery('');
                }}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap lg:justify-end">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-1">Filter:</span>
              <div className="relative inline-block" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="bg-white border border-slate-200/80 hover:border-slate-300 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-primary/60 cursor-pointer transition-all flex items-center gap-2 shadow-sm min-w-[120px] max-w-[150px] justify-between"
                >
                  <span className="truncate pr-1">
                    {selectedCampaign === 'all' 
                      ? 'All Campaigns' 
                      : (() => {
                          const match = campaignList.find(c => (c.id || c) === selectedCampaign);
                          const dateStr = match && match.date ? ` — ${match.date}` : '';
                          return `${selectedCampaign}${dateStr}`;
                        })()
                    }
                  </span>
                  <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 shrink-0 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {isDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 5, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 5, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-1.5 w-64 bg-white/90 backdrop-blur-md border border-slate-200/60 rounded-xl shadow-lg shadow-slate-200/20 py-1.5 z-30 max-h-60 overflow-y-auto scrollbar-thin"
                    >
                      <button
                         type="button"
                         onClick={() => {
                           setSelectedCampaign('all');
                           setIsDropdownOpen(false);
                         }}
                         className={`w-full text-left px-3.5 py-2 text-xs font-semibold transition-colors hover:bg-primary/5 hover:text-primary flex items-center justify-between
                           ${selectedCampaign === 'all' ? 'text-primary bg-primary/5' : 'text-slate-600'}`}
                      >
                        <span>All Campaigns</span>
                        {selectedCampaign === 'all' && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                      </button>
                      {campaignList.map((camp) => {
                        const campId = camp.id || camp;
                        const campDate = camp.date || campaignDates[campId];
                        return (
                          <button
                            key={campId}
                            type="button"
                            onClick={() => {
                              setSelectedCampaign(campId);
                              setIsDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3.5 py-2 text-xs font-semibold transition-colors hover:bg-primary/5 hover:text-primary flex items-center justify-between
                              ${selectedCampaign === campId ? 'text-primary bg-primary/5' : 'text-slate-600'}`}
                          >
                            <span className="truncate pr-2 flex flex-col">
                              <span>{campId}</span>
                              {campDate && (
                                <span className="text-[10px] font-normal text-slate-400 mt-0.5">
                                  {campDate}
                                </span>
                              )}
                            </span>
                            {selectedCampaign === campId && <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Platform Filter */}
              <div className="relative inline-block" ref={platformDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsPlatformDropdownOpen(!isPlatformDropdownOpen)}
                  className="bg-white border border-slate-200/80 hover:border-slate-300 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-primary/60 cursor-pointer transition-all flex items-center gap-2 shadow-sm min-w-[110px] max-w-[130px] justify-between"
                >
                  <span className="truncate pr-1">
                    {selectedPlatform === 'all' ? 'All Platforms' : selectedPlatform}
                  </span>
                  <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 shrink-0 ${isPlatformDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {isPlatformDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 5, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 5, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-1.5 w-40 bg-white/90 backdrop-blur-md border border-slate-200/60 rounded-xl shadow-lg shadow-slate-200/20 py-1.5 z-30 overflow-hidden"
                    >
                      {['all', 'WhatsApp', 'Email'].map((plat) => (
                        <button
                          key={plat}
                          type="button"
                          onClick={() => {
                            setSelectedPlatform(plat);
                            setIsPlatformDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3.5 py-2 text-xs font-semibold transition-colors hover:bg-primary/5 hover:text-primary flex items-center justify-between
                            ${selectedPlatform === plat ? 'text-primary bg-primary/5' : 'text-slate-600'}`}
                        >
                          <span>{plat === 'all' ? 'All Platforms' : plat}</span>
                          {selectedPlatform === plat && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Subscription Filter */}
              <div className="relative inline-block" ref={subscriptionDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsSubscriptionDropdownOpen(!isSubscriptionDropdownOpen)}
                  className="bg-white border border-slate-200/80 hover:border-slate-300 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-primary/60 cursor-pointer transition-all flex items-center gap-2 shadow-sm min-w-[120px] max-w-[140px] justify-between"
                >
                  <span className="truncate pr-1">
                    {selectedSubscription === 'all' 
                      ? 'All Subscriptions' 
                      : selectedSubscription === 'Yes' 
                        ? 'Subscribed (Yes)' 
                        : 'Unsubscribed (No)'}
                  </span>
                  <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 shrink-0 ${isSubscriptionDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {isSubscriptionDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 5, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 5, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-1.5 w-44 bg-white/90 backdrop-blur-md border border-slate-200/60 rounded-xl shadow-lg shadow-slate-200/20 py-1.5 z-30 overflow-hidden"
                    >
                      {[
                        { value: 'all', label: 'All Subscriptions' },
                        { value: 'Yes', label: 'Subscribed (Yes)' },
                        { value: 'No', label: 'Unsubscribed (No)' }
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setSelectedSubscription(opt.value);
                            setIsSubscriptionDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3.5 py-2 text-xs font-semibold transition-colors hover:bg-primary/5 hover:text-primary flex items-center justify-between
                            ${selectedSubscription === opt.value ? 'text-primary bg-primary/5' : 'text-slate-600'}`}
                        >
                          <span>{opt.label}</span>
                          {selectedSubscription === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Status Filter */}
              <div className="relative inline-block" ref={statusDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                  className="bg-white border border-slate-200/80 hover:border-slate-300 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-primary/60 cursor-pointer transition-all flex items-center gap-2 shadow-sm min-w-[110px] max-w-[130px] justify-between"
                >
                  <span className="truncate pr-1">
                    {selectedStatus === 'all' 
                      ? 'All Statuses' 
                      : selectedStatus}
                  </span>
                  <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 shrink-0 ${isStatusDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {isStatusDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 5, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 5, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-1.5 w-40 bg-white/90 backdrop-blur-md border border-slate-200/60 rounded-xl shadow-lg shadow-slate-200/20 py-1.5 z-30 overflow-hidden"
                    >
                      {[
                        { value: 'all', label: 'All Statuses' },
                        { value: 'Seen', label: 'Seen' },
                        { value: 'Sent', label: 'Sent' },
                        { value: 'Unsubscribed', label: 'Unsubscribed' },
                        { value: 'Failed', label: 'Failed' }
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setSelectedStatus(opt.value);
                            setIsStatusDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3.5 py-2 text-xs font-semibold transition-colors hover:bg-primary/5 hover:text-primary flex items-center justify-between
                            ${selectedStatus === opt.value ? 'text-primary bg-primary/5' : 'text-slate-600'}`}
                        >
                          <span>{opt.label}</span>
                          {selectedStatus === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

            {/* Generated By Filter */}
            {user && user.role === 'Admin' && (
              <div className="relative inline-block" ref={creatorDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsCreatorDropdownOpen(!isCreatorDropdownOpen)}
                  className="bg-white border border-slate-200/80 hover:border-slate-300 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-primary/60 cursor-pointer transition-all flex items-center gap-2 shadow-sm min-w-[120px] max-w-[140px] justify-between"
                >
                  <span className="truncate pr-1">
                    {selectedCreator === 'all' ? 'All Creators' : selectedCreator}
                  </span>
                  <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 shrink-0 ${isCreatorDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {isCreatorDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 5, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 5, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-1.5 w-48 bg-white/90 backdrop-blur-md border border-slate-200/60 rounded-xl shadow-lg shadow-slate-200/20 py-1.5 z-30 max-h-60 overflow-y-auto scrollbar-thin"
                    >
                      {uniqueCreators.map((creator) => (
                        <button
                          key={creator}
                          type="button"
                          onClick={() => {
                            setSelectedCreator(creator);
                            setIsCreatorDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3.5 py-2 text-xs font-semibold transition-colors hover:bg-primary/5 hover:text-primary flex items-center justify-between
                            ${selectedCreator === creator ? 'text-primary bg-primary/5' : 'text-slate-600'}`}
                        >
                          <span className="truncate pr-2">{creator === 'all' ? 'All Creators' : creator}</span>
                          {selectedCreator === creator && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Date Picker Filter */}
            <div className="flex items-center gap-1.5 relative" ref={datePopoverRef}>
              <button
                type="button"
                onClick={() => setIsDatePopoverOpen(!isDatePopoverOpen)}
                className={`p-2 rounded-xl border bg-white cursor-pointer transition-all hover:bg-slate-50 flex items-center justify-center shadow-sm relative z-10
                  ${(selectedDate && dateFilterType === 'single') || ((startDate || endDate) && dateFilterType === 'range')
                    ? 'border-primary text-primary bg-primary/5 hover:bg-primary/10'
                    : 'border-slate-200/80 text-slate-500 hover:text-slate-700'
                  }`}
                title="Filter by Date / Range"
              >
                <Calendar size={14} />
                {((selectedDate && dateFilterType === 'single') || ((startDate || endDate) && dateFilterType === 'range')) && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary animate-pulse" />
                )}
              </button>

              <AnimatePresence>
                {isDatePopoverOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 5, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 5, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-1.5 w-72 bg-white/95 backdrop-blur-md border border-slate-200/60 rounded-2xl shadow-xl p-4 z-40 space-y-4"
                  >
                    <div className="flex gap-2 p-1 bg-slate-100 border border-slate-200/60 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setDateFilterType('single')}
                        className={`flex-1 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors duration-150 cursor-pointer ${dateFilterType === 'single' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        Specific Date
                      </button>
                      <button
                        type="button"
                        onClick={() => setDateFilterType('range')}
                        className={`flex-1 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors duration-150 cursor-pointer ${dateFilterType === 'range' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        Date Range
                      </button>
                    </div>

                    {dateFilterType === 'single' ? (
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Select Date</label>
                        <input
                          type="date"
                          value={selectedDate}
                          onChange={(e) => setSelectedDate(e.target.value)}
                          className="w-full input-field px-3 py-2 text-xs"
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Start Date</label>
                          <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full input-field px-3 py-2 text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">End Date</label>
                          <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full input-field px-3 py-2 text-xs"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 justify-end border-t border-slate-100 pt-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDate('');
                          setStartDate('');
                          setEndDate('');
                          setIsDatePopoverOpen(false);
                        }}
                        className="px-3 py-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-500 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        Clear All
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsDatePopoverOpen(false)}
                        className="px-3 py-1.5 bg-gradient-to-r from-primary to-secondary text-white rounded-xl text-xs font-bold hover:brightness-105 active:scale-[0.98] transition-all cursor-pointer shadow-md shadow-primary/10"
                      >
                        Apply
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {((selectedDate && dateFilterType === 'single') || ((startDate || endDate) && dateFilterType === 'range')) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDate('');
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="p-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-500 hover:bg-rose-100/70 hover:text-rose-600 transition-all cursor-pointer flex items-center justify-center shadow-sm"
                  title="Clear Date Filter"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-auto max-h-[600px] rounded-xl border border-slate-100 bg-white scrollbar-thin">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/75">
                <th className="sticky top-0 bg-slate-50/90 backdrop-blur-sm z-10 p-4 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">Campaign ID</th>
                <th className="sticky top-0 bg-slate-50/90 backdrop-blur-sm z-10 p-4 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">Recipient</th>
                <th className="sticky top-0 bg-slate-50/90 backdrop-blur-sm z-10 p-4 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">Company Name</th>
                <th className="sticky top-0 bg-slate-50/90 backdrop-blur-sm z-10 p-4 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">Platform</th>
                <th className="sticky top-0 bg-slate-50/90 backdrop-blur-sm z-10 p-4 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">Contact Address</th>
                <th className="sticky top-0 bg-slate-50/90 backdrop-blur-sm z-10 p-4 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">Date</th>
                {user && user.role === 'Admin' && (
                  <th className="sticky top-0 bg-slate-50/90 backdrop-blur-sm z-10 p-4 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">Sent By</th>
                )}
                <th className="sticky top-0 bg-slate-50/90 backdrop-blur-sm z-10 p-4 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 text-center">Status</th>
                <th className="sticky top-0 bg-slate-50/90 backdrop-blur-sm z-10 p-4 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 text-center">Subscription (Yes / No)</th>
                <th className="sticky top-0 bg-slate-50/90 backdrop-blur-sm z-10 p-4 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">Unsubscribe Reason</th>
                <th className="sticky top-0 bg-slate-50/90 backdrop-blur-sm z-10 p-4 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">If Other (Reason)</th>
                <th className="sticky top-0 bg-slate-50/90 backdrop-blur-sm z-10 p-4 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredResults.length === 0 ? (
                <tr>
                  <td colSpan={user && user.role === 'Admin' ? "12" : "11"} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      {isLoadingLogs ? (
                        <>
                          <Loader2 className="animate-spin text-primary/40 w-7 h-7" />
                          <span className="text-slate-400 text-sm font-medium">Fetching campaign logs...</span>
                          <span className="text-slate-300 text-xs">Connecting to DB...</span>
                        </>
                      ) : (
                        <>
                          <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                            <Layers className="text-slate-300 w-8 h-8" />
                          </div>
                          <p className="text-slate-500 text-sm font-semibold">
                            {campaignResults.length === 0 ? 'No campaign logs found' : 'No logs match the selected filters'}
                          </p>
                          <p className="text-slate-300 text-xs max-w-xs text-center">
                            {campaignResults.length === 0
                              ? 'Start a campaign to see delivery logs here. Logs are fetched from your Google Sheet.'
                              : 'Try changing the campaign filter or date to view other logs.'}
                          </p>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredResults.map((result, idx) => (
                  <motion.tr
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.3) }}
                    key={idx}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="p-4 text-xs text-slate-500 font-medium whitespace-nowrap">{result.campaign_id || selectedCampaign}</td>
                    <td className="p-4 font-semibold text-slate-700">{result.name}</td>
                    <td className="p-4 text-xs text-slate-600 font-semibold">{result.company || "-"}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${result.type === 'WhatsApp' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-sky-50 text-sky-600 border border-sky-100'}`}>
                        {result.type}
                      </span>
                    </td>
                    <td className="p-4 text-slate-500 font-mono text-xs">{result.phone || result.email}</td>
                    <td className="p-4 text-xs text-slate-500 font-medium whitespace-nowrap">
                      {formatExactDate(result.sent_time)}
                    </td>
                    {user && user.role === 'Admin' && (
                      <td className="p-4 text-xs text-slate-600 font-bold whitespace-nowrap">
                        {result.generated_by || "System"}
                      </td>
                    )}
                    <td className="p-4 text-center">
                      {result.status === 'Seen' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 border border-blue-100 text-blue-600">
                          <Eye size={12} className="animate-pulse" />
                          <span>Seen</span>
                        </span>
                      ) : result.status === 'Sent' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 border border-emerald-100 text-emerald-600">
                          <CheckCircle size={12} />
                          <span>Sent</span>
                        </span>
                      ) : result.status === 'Unsubscribed' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 border border-amber-100 text-amber-600">
                          <EyeOff size={12} />
                          <span>Unsubscribed</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 border border-rose-100 text-rose-500">
                          <AlertCircle size={12} />
                          <span>Failed</span>
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${result.subscription === 'No' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                        {result.subscription || "Yes"}
                      </span>
                    </td>
                    <td className="p-4 text-xs text-slate-600 font-semibold">{result.unsub_reason || "-"}</td>
                    <td className="p-4 text-xs text-slate-500 max-w-[150px] truncate">{result.unsub_other || "-"}</td>
                    <td className="p-4 text-xs text-slate-400 max-w-xs truncate">
                      {result.reason || "Delivered successfully"}
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      </div> {/* Closing Main Content Area */}

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl backdrop-blur-md border border-white/20 transition-all max-w-sm
              ${toast.type === 'error'
                ? 'bg-rose-50/90 text-rose-800 border-rose-100 shadow-rose-100/35'
                : 'bg-emerald-50/90 text-emerald-800 border-emerald-100 shadow-emerald-100/35'
              }`}
          >
            {toast.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
            ) : (
              <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
            )}
            <p className="text-xs font-semibold">{toast.message}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
