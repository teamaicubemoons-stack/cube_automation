import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Upload, Send, MessageSquare, Mail, CheckCircle, AlertCircle, Loader2, Wand2, Eye, Phone, User, Layers, ChevronDown, Sparkles, Calendar, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE_URL = 'http://localhost:8000/api';

function App() {
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
  const [emailsSentToday, setEmailsSentToday] = useState(0);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
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
    fetchCampaigns();
  }, [spreadsheetId]);

  useEffect(() => {
    let interval;
    interval = setInterval(async () => {
      try {
        const spreadsheetParam = spreadsheetId ? `?spreadsheet_id=${spreadsheetId}` : '';
        const endpoint = selectedCampaign === 'all'
          ? `${API_BASE_URL}/campaign/all/status${spreadsheetParam}`
          : `${API_BASE_URL}/campaign/${selectedCampaign}/status${spreadsheetParam}`;
        const response = await axios.get(endpoint);
        setCampaignResults(response.data);

        // Fetch daily emails sent count
        const countResponse = await axios.get(`${API_BASE_URL}/campaign/emails-sent-today${spreadsheetParam}`);
        setEmailsSentToday(countResponse.data.emails_sent_today);
      } catch (error) {
        console.error("Status polling failed", error);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [selectedCampaign, spreadsheetId]);

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

  const getLatestRange = () => {
    if (!campaignList || campaignList.length === 0) return null;
    const latestCampaign = campaignList[0];
    const match = latestCampaign.match(/\(([^)]+)\)/);
    return match ? match[1] : 'All';
  };
  const latestRange = getLatestRange();

  const filteredResults = campaignResults.filter((result) => {
    if (selectedDate) {
      if (!result.sent_time || !result.sent_time.includes(selectedDate)) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto p-4 md:py-6 md:px-12">
      <header className="mb-6 md:mb-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-center mb-3"
        >
          <img src="/logo.png" alt="Cubemoons Logo" className="h-14 w-auto object-contain" />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-xs font-semibold text-primary mb-3"
        >
          <Sparkles size={12} className="text-secondary animate-pulse" />
          <span>Enterprise Campaign Console</span>
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
                ${
                  file
                    ? 'border-emerald-400/50 bg-emerald-50/30'
                    : isDragging
                    ? 'border-primary bg-primary/5 scale-[1.01]'
                    : 'border-slate-200 hover:border-primary/60 hover:bg-blue-50/30'
                }`}
            >
              <div className="space-y-4 pointer-events-none">
                <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center transition-all
                  ${
                    file
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
                  <p className={`text-sm font-semibold ${
                    file ? 'text-emerald-600' : isDragging ? 'text-primary' : 'text-slate-700'
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

      {/* Progress Section */}
      <section className="mt-8 md:mt-12 glass p-5 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
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
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Filter:</span>
            <div className="relative inline-block" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="bg-white border border-slate-200/80 hover:border-slate-300 rounded-xl pl-3 pr-9 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-primary/60 cursor-pointer transition-all flex items-center gap-2 shadow-sm min-w-[150px] justify-between"
              >
                <span className="truncate pr-1">
                  {selectedCampaign === 'all' ? 'All Campaigns' : selectedCampaign}
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
                    {campaignList.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          setSelectedCampaign(id);
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3.5 py-2 text-xs font-semibold transition-colors hover:bg-primary/5 hover:text-primary flex items-center justify-between
                          ${selectedCampaign === id ? 'text-primary bg-primary/5' : 'text-slate-600'}`}
                      >
                        <span className="truncate pr-2">{id}</span>
                        {selectedCampaign === id && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Date Picker Filter */}
            <div className="flex items-center gap-1.5 relative">
              <input
                ref={dateInputRef}
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="absolute left-0 top-0 w-8 h-8 opacity-0 pointer-events-none -z-10"
              />
              <button
                type="button"
                onClick={() => dateInputRef.current?.showPicker()}
                className={`p-2 rounded-xl border bg-white cursor-pointer transition-all hover:bg-slate-50 flex items-center justify-center shadow-sm relative z-10
                  ${selectedDate 
                    ? 'border-primary text-primary bg-primary/5 hover:bg-primary/10' 
                    : 'border-slate-200/80 text-slate-500 hover:text-slate-700'
                  }`}
                title={selectedDate ? `Date: ${selectedDate}` : "Filter by Date"}
              >
                <Calendar size={14} />
                {selectedDate && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary animate-pulse" />
                )}
              </button>
              {selectedDate && (
                <button
                  type="button"
                  onClick={() => setSelectedDate('')}
                  className="p-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-500 hover:bg-rose-100/70 hover:text-rose-600 transition-all cursor-pointer flex items-center justify-center shadow-sm"
                  title="Clear Date Filter"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-auto max-h-[480px] rounded-xl border border-slate-100 bg-white scrollbar-thin">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/75">
                <th className="sticky top-0 bg-slate-50/90 backdrop-blur-sm z-10 p-4 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">Recipient</th>
                <th className="sticky top-0 bg-slate-50/90 backdrop-blur-sm z-10 p-4 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">Platform</th>
                <th className="sticky top-0 bg-slate-50/90 backdrop-blur-sm z-10 p-4 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">Contact Address</th>
                <th className="sticky top-0 bg-slate-50/90 backdrop-blur-sm z-10 p-4 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">Sent Time</th>
                <th className="sticky top-0 bg-slate-50/90 backdrop-blur-sm z-10 p-4 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 text-center">Delivery Status</th>
                <th className="sticky top-0 bg-slate-50/90 backdrop-blur-sm z-10 p-4 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">Reason / Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredResults.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-slate-400 italic">
                    <div className="flex flex-col items-center justify-center gap-2">
                      {campaignResults.length === 0 ? (
                        <>
                          <Loader2 className="animate-spin text-slate-300 w-6 h-6" />
                          <span>Waiting for campaigns to stream logs...</span>
                        </>
                      ) : (
                        <span>No logs found matching the filters.</span>
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
                    <td className="p-4 font-semibold text-slate-700">{result.name}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${result.type === 'WhatsApp' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-sky-50 text-sky-600 border border-sky-100'}`}>
                        {result.type}
                      </span>
                    </td>
                    <td className="p-4 text-slate-500 font-mono text-xs">{result.phone || result.email}</td>
                    <td className="p-4 text-xs text-slate-500 font-medium whitespace-nowrap">
                      {result.sent_time || "Pending..."}
                    </td>
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
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 border border-rose-100 text-rose-500">
                          <AlertCircle size={12} />
                          <span>Failed</span>
                        </span>
                      )}
                    </td>
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
