import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Upload, Send, MessageSquare, Mail, CheckCircle, AlertCircle, Loader2, Wand2, Eye, Phone, User, Layers, ChevronDown, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE_URL = 'http://localhost:8000/api';

function App() {
  const [file, setFile] = useState(null);
  const [uploadData, setUploadData] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [platform, setPlatform] = useState('whatsapp'); // whatsapp, email, both
  const [whatsappMsg, setWhatsappMsg] = useState('Hi {name}, how are you?');
  const [emailSubject, setEmailSubject] = useState('Important Update');
  const [emailBody, setEmailBody] = useState('Hi {name},\n\nWe have an update for you.');
  const [mapping, setMapping] = useState({});
  const [spreadsheetId, setSpreadsheetId] = useState('1R3tBUcQKzMX-pjPBjPCkiOeWZwukGGjtKPM9K5OyRJ0');
  const [campaignId, setCampaignId] = useState(null);
  const [campaignResults, setCampaignResults] = useState([]);
  const [campaignList, setCampaignList] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState('all');

  const fetchCampaigns = async () => {
    if (!spreadsheetId) return;
    try {
      const response = await axios.get(`${API_BASE_URL}/campaigns?spreadsheet_id=${spreadsheetId}`);
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
    if (spreadsheetId) {
      interval = setInterval(async () => {
        try {
          const endpoint = selectedCampaign === 'all'
            ? `${API_BASE_URL}/campaign/all/status?spreadsheet_id=${spreadsheetId}`
            : `${API_BASE_URL}/campaign/${selectedCampaign}/status?spreadsheet_id=${spreadsheetId}`;
          const response = await axios.get(endpoint);
          setCampaignResults(response.data);
        } catch (error) {
          console.error("Status polling failed", error);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [selectedCampaign, spreadsheetId]);

  const handleFileUpload = async (e) => {
    const selectedFile = e.target.files[0];
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
      alert("Failed to upload and detect columns.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleStartCampaign = async () => {
    if (!spreadsheetId) {
      alert("Please enter a Google Sheet ID first.");
      return;
    }
    setIsStarting(true);
    setCampaignResults([]); // Clear old results
    const formData = new FormData();
    formData.append('platform', platform);
    formData.append('spreadsheet_id', spreadsheetId);
    formData.append('whatsapp_message', whatsappMsg);
    formData.append('email_subject', emailSubject);
    formData.append('email_body', emailBody);
    formData.append('mapping', JSON.stringify(mapping));

    try {
      const response = await axios.post(`${API_BASE_URL}/start-campaign`, formData);
      setCampaignId(response.data.campaign_id);
      setSelectedCampaign(response.data.campaign_id);
      alert(response.data.message);
      fetchCampaigns();
    } catch (error) {
      console.error("Campaign start failed", error);
      const errorMsg = error.response?.data?.detail || "Failed to start campaign.";
      alert(errorMsg);
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

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-12">
      <header className="mb-8 md:mb-12 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-xs font-semibold text-primary mb-6"
        >
          <Sparkles size={12} className="text-secondary animate-pulse" />
          <span>Enterprise Campaign Console</span>
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary via-secondary to-accent mb-4"
        >
          AI Bulk Messaging System
        </motion.h1>
        <p className="text-slate-500 text-sm md:text-lg max-w-2xl mx-auto font-medium">Smart AI integration for seamless WhatsApp and Email campaigns</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        {/* Step 1: Upload */}
        <section className="glass p-5 md:p-8 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-primary/10 border border-primary/20 rounded-xl">
              <Upload className="text-primary w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-slate-800">1. Data Source</h2>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Google Sheet ID</label>
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
                placeholder="Enter Spreadsheet ID (from URL)"
              />
              <p className="text-[10px] text-slate-400 italic">Example: 1R3tBUcQKzMXpjpBJpCkiOeWZwukGGjtKPM9K5OyRJ0</p>
            </div>

            <div className={`relative border-2 border-dashed rounded-2xl p-6 md:p-8 text-center transition-all group cursor-pointer ${file ? 'border-emerald-500/30 bg-emerald-50/20' : 'border-slate-200 hover:border-primary/50 hover:bg-slate-50/30'}`}>
              <input
                type="file"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className="space-y-4">
                <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center transition-transform group-hover:scale-105 ${file ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400 group-hover:bg-primary/10 group-hover:text-primary'}`}>
                  {isUploading ? (
                    <Loader2 className="animate-spin" />
                  ) : file ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <Upload className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <p className={`text-sm font-semibold ${file ? 'text-emerald-600' : 'text-slate-700'}`}>
                    {file ? file.name : "Upload CSV or Excel file"}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {file ? `${(file.size / 1024).toFixed(1)} KB` : "Drag and drop or click to browse"}
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
        <section className="glass p-5 md:p-8 space-y-6">
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

          <div className="space-y-6">
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
                  className="w-full h-24 input-field resize-none focus:ring-1 focus:ring-primary/20"
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
                    className="w-full h-32 input-field resize-none focus:ring-1 focus:ring-primary/20"
                    placeholder="Use {name} or other variables. HTML formatting is supported."
                  />
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleStartCampaign}
            disabled={isStarting || (!uploadData && !spreadsheetId)}
            className={`w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${isStarting || (!uploadData && !spreadsheetId) ? 'bg-slate-100 text-slate-400 border border-slate-200/50 cursor-not-allowed' : 'btn-primary'}`}
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
              <h2 className="text-xl font-bold tracking-tight text-slate-800">Campaign Logs</h2>
              <p className="text-xs text-slate-400 mt-0.5">Real-time status updates (2s polling active)</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Filter:</span>
            <div className="relative inline-block">
              <select
                value={selectedCampaign}
                onChange={(e) => setSelectedCampaign(e.target.value)}
                className="bg-white border border-slate-200/80 hover:border-slate-300 rounded-xl pl-3 pr-8 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-primary/60 cursor-pointer transition-all appearance-none shadow-sm"
              >
                <option value="all" className="bg-white text-slate-700">All Campaigns</option>
                {campaignList.map((id) => (
                  <option key={id} value={id} className="bg-white text-slate-700">
                    Campaign {id.substring(0, 8)}...
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/75">
                <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-400">Recipient</th>
                <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-400">Platform</th>
                <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-400">Contact Address</th>
                <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-400 text-center">Delivery Status</th>
                <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-400">Reason / Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {campaignResults.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-12 text-center text-slate-400 italic">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="animate-spin text-slate-300 w-6 h-6" />
                      <span>Waiting for campaigns to stream logs...</span>
                    </div>
                  </td>
                </tr>
              ) : (
                campaignResults.map((result, idx) => (
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
    </div>
  );
}

export default App;
