import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Upload, Send, MessageSquare, Mail, CheckCircle, AlertCircle, Loader2, Wand2 } from 'lucide-react';
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
  const [spreadsheetId, setSpreadsheetId] = useState('1R3tBUcQKzMXpjpBJpCkiOeWZwukGGjtKPM9K5OyRJ0');
  const [campaignId, setCampaignId] = useState(null);
  const [campaignResults, setCampaignResults] = useState([]);

  useEffect(() => {
    let interval;
    if (campaignId) {
      interval = setInterval(async () => {
        try {
          const response = await axios.get(`${API_BASE_URL}/campaign/${campaignId}/status`);
          setCampaignResults(response.data);
          
          // Optional: Stop polling if all tasks are done (needs extra logic)
        } catch (error) {
          console.error("Status polling failed", error);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [campaignId]);

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
      alert(response.data.message);
    } catch (error) {
      console.error("Campaign start failed", error);
      alert("Failed to start campaign.");
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
    <div className="max-w-6xl mx-auto p-6 md:p-12">
      <header className="mb-12 text-center">
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary via-secondary to-accent mb-4"
        >
          AI Bulk Messaging System
        </motion.h1>
        <p className="text-gray-400 text-lg">Smart AI integration for seamless WhatsApp and Email campaigns</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Step 1: Upload */}
        <section className="glass p-8 space-y-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-primary/20 rounded-xl">
              <Upload className="text-primary" />
            </div>
            <h2 className="text-2xl font-bold">1. Data Source</h2>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Google Sheet ID</label>
              <input 
                type="text" 
                value={spreadsheetId}
                onChange={(e) => setSpreadsheetId(e.target.value)}
                className="w-full input-field"
                placeholder="Enter Spreadsheet ID (from URL)"
              />
              <p className="text-[10px] text-gray-500 italic">Example: 1R3tBUcQKzMXpjpBJpCkiOeWZwukGGjtKPM9K5OyRJ0</p>
            </div>

            <div className="relative border-2 border-dashed border-white/10 rounded-2xl p-10 text-center hover:border-primary transition-all group cursor-pointer">
              <input 
                type="file" 
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className="space-y-4">
                <div className="mx-auto w-16 h-16 bg-white/5 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                  {isUploading ? <Loader2 className="animate-spin text-primary" /> : <Upload className="text-gray-400" />}
                </div>
                <div>
                  <p className="text-lg font-medium">{file ? file.name : "Click to upload CSV or Excel"}</p>
                  <p className="text-sm text-gray-500">AI will automatically detect columns</p>
                </div>
              </div>
            </div>
          </div>


          <AnimatePresence>
            {uploadData && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-4 pt-4 border-t border-white border-opacity-10"
              >
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">AI Detected Mappings</h3>
                <div className="grid grid-cols-3 gap-4">
                  {Object.entries(mapping).map(([key, value]) => (
                    <div key={key} className="p-3 bg-white/5 rounded-lg border border-white/10">
                      <p className="text-xs text-gray-400 capitalize">{key}</p>
                      <p className="font-medium text-secondary">{value || "Not Found"}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Step 2: Compose */}
        <section className="glass p-8 space-y-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-secondary/20 rounded-xl">
              <MessageSquare className="text-secondary" />
            </div>
            <h2 className="text-2xl font-bold">2. Compose Campaign</h2>
          </div>

          <div className="flex gap-4 p-1 bg-white/5 rounded-xl">
            {['whatsapp', 'email', 'both'].map((p) => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${platform === p ? 'bg-secondary text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
              >
                {p.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="space-y-6">
            {(platform === 'whatsapp' || platform === 'both') && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-gray-300">WhatsApp Message</label>
                  <button onClick={() => handleRewrite('whatsapp')} className="text-xs flex items-center gap-1 text-accent hover:underline">
                    <Wand2 size={12} /> AI Rewrite
                  </button>
                </div>
                <textarea 
                  value={whatsappMsg}
                  onChange={(e) => setWhatsappMsg(e.target.value)}
                  className="w-full h-24 input-field resize-none"
                  placeholder="Use {name} for personalization"
                />
              </div>
            )}

            {(platform === 'email' || platform === 'both') && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Email Subject</label>
                  <input 
                    type="text" 
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="w-full input-field"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-gray-300">Email Body</label>
                    <button onClick={() => handleRewrite('email')} className="text-xs flex items-center gap-1 text-accent hover:underline">
                      <Wand2 size={12} /> AI Rewrite
                    </button>
                  </div>
                  <textarea 
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    className="w-full h-32 input-field resize-none"
                  />
                </div>
              </div>
            )}
          </div>

          <button 
            onClick={handleStartCampaign}
            disabled={isStarting || (!uploadData && !spreadsheetId)}
            className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${(!uploadData && !spreadsheetId) ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'btn-primary shadow-xl shadow-primary/20'}`}
          >
            {isStarting ? <Loader2 className="animate-spin" /> : <><Send size={18} /> Launch Campaign</>}
          </button>

        </section>
      </div>

      {/* Progress Section */}
      <section className="mt-12 glass p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-accent/20 rounded-xl">
              <CheckCircle className="text-accent" />
            </div>
            <h2 className="text-2xl font-bold">Campaign Logs (2s Delay Active)</h2>
          </div>
          <div className="text-sm text-gray-500 italic">Campaign ID: {campaignId || 'No active campaign'}</div>
        </div>
        
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5">
                <th className="p-4 text-xs font-semibold uppercase tracking-wider text-gray-400">Recipient</th>
                <th className="p-4 text-xs font-semibold uppercase tracking-wider text-gray-400">Platform</th>
                <th className="p-4 text-xs font-semibold uppercase tracking-wider text-gray-400">Contact</th>
                <th className="p-4 text-xs font-semibold uppercase tracking-wider text-gray-400 text-center">Status</th>
                <th className="p-4 text-xs font-semibold uppercase tracking-wider text-gray-400">Reason/Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {campaignResults.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-12 text-center text-gray-500 italic">
                    Waiting for campaign to start...
                  </td>
                </tr>
              ) : (
                campaignResults.map((result, idx) => (
                  <motion.tr 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={idx} 
                    className="hover:bg-white/5 transition-colors"
                  >
                    <td className="p-4 font-medium">{result.name}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${result.type === 'WhatsApp' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>
                        {result.type}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-gray-400">{result.phone || result.email}</td>
                    <td className="p-4 text-center">
                      {result.status === 'Sent' ? (
                        <div className="flex items-center justify-center text-green-400 gap-1">
                          <CheckCircle size={16} />
                          <span className="text-xs font-bold">Success</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center text-red-400 gap-1">
                          <AlertCircle size={16} />
                          <span className="text-xs font-bold">Failed</span>
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-xs text-gray-500 max-w-xs truncate">
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
