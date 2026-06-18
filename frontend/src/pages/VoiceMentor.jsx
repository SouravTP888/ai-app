import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import CourseCard from '../components/CourseCard';
import axios from 'axios';
import { 
  Mic, 
  MicOff, 
  Play, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  History, 
  MessageSquare,
  Award,
  BookOpen,
  ArrowRight,
  TrendingUp,
  Cpu,
  Bot
} from 'lucide-react';

const VoiceMentor = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  // Voice recognition instance
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  
  // Synthesized speech state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [muteTTS, setMuteTTS] = useState(false);
  
  // AI states: 'idle' | 'listening' | 'thinking' | 'speaking'
  const [avatarState, setAvatarState] = useState('idle');
  
  // Chats and recommendations
  const [chatHistory, setChatHistory] = useState([]);
  const [currentResponse, setCurrentResponse] = useState(null); // { userMessage, aiResponse, recommendedCourses, timestamp }
  const [loading, setLoading] = useState(false);
  
  // Course progress maps for CourseCards
  const [progressMap, setProgressMap] = useState({});
  const [dbCourses, setDbCourses] = useState([]);

  // Browser speech recognition API
  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setAvatarState('listening');
        if (synthRef.current) {
          synthRef.current.cancel(); // Stop talking when user starts speaking
        }
      };

      recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        setTranscript(text);
        submitQuery(text);
      };

      recognition.onerror = (e) => {
        console.error('Speech recognition error:', e.error);
        setIsListening(false);
        setAvatarState('idle');
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  // Fetch History and Course database
  const loadData = async () => {
    try {
      // 1. Fetch History
      const histRes = await axios.get('/voice/history');
      if (histRes.data.success) {
        setChatHistory(histRes.data.history);
        if (histRes.data.history.length > 0) {
          // Default load the latest conversation details
          setCurrentResponse(histRes.data.history[0]);
        }
      }

      // 2. Fetch all courses
      const coursesRes = await axios.get('/courses');
      if (coursesRes.data.success) {
        setDbCourses(coursesRes.data.courses);
      }

      // 3. Fetch progress details
      if (user) {
        const userId = user.id || user._id;
        const progRes = await axios.get(`/progress/${userId}`);
        if (progRes.data.success) {
          const progMap = {};
          progRes.data.progress.forEach(p => {
            if (p.courseId) {
              const cId = p.courseId._id || p.courseId.id || p.courseId;
              progMap[cId.toString()] = p;
            }
          });
          setProgressMap(progMap);
        }
      }
    } catch (err) {
      console.error('Failed to load mentor workspace data:', err);
    }
  };

  useEffect(() => {
    loadData();
    
    // Cleanup synthesis on page leave
    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, [user]);

  // Handle Speech capture toggle
  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Speech Recognition is not supported on this browser. Please try Chrome, Edge, or Safari.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      if (isSpeaking) {
        synthRef.current.cancel();
        setIsSpeaking(false);
      }
      setTranscript('Listening for your voice...');
      recognitionRef.current.start();
    }
  };

  // Submit text query to Backend
  const submitQuery = async (queryText) => {
    if (!queryText.trim()) return;
    setLoading(true);
    setAvatarState('thinking');
    
    try {
      const res = await axios.post('/voice/chat', { message: queryText });
      if (res.data.success) {
        const responseData = res.data;
        setCurrentResponse(responseData);
        
        // Add to history list at the top
        setChatHistory(prev => [responseData, ...prev]);

        // Synthesize voice response if not muted
        if (!muteTTS) {
          speakResponse(responseData.aiResponse);
        } else {
          setAvatarState('idle');
        }

        // Reload courses progress details
        loadData();
      }
    } catch (err) {
      console.error('Failed to generate response:', err);
      setAvatarState('idle');
    } finally {
      setLoading(false);
    }
  };

  // Browser Text-To-Speech Synthesis
  const speakResponse = (text) => {
    if (!synthRef.current) return;

    synthRef.current.cancel(); // cancel current speech

    // Remove markdown formatting / course numbers for cleaner speech
    const cleanText = text.replace(/[*#`_\-]/g, '').replace(/\d+\)/g, '');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Match standard speech options
    const voices = synthRef.current.getVoices();
    const premiumVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) ||
                         voices.find(v => v.lang.startsWith('en') && v.name.includes('Natural')) ||
                         voices.find(v => v.lang.startsWith('en')) || 
                         voices[0];
    if (premiumVoice) {
      utterance.voice = premiumVoice;
    }
    
    utterance.rate = 1.0;
    utterance.pitch = 1.05;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setAvatarState('speaking');
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setAvatarState('idle');
    };

    utterance.onerror = (e) => {
      console.error('Speech synthesis error:', e);
      setIsSpeaking(false);
      setAvatarState('idle');
    };

    synthRef.current.speak(utterance);
  };

  // Stop current speaking audio
  const stopSpeaking = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
      setAvatarState('idle');
    }
  };

  // Select item from sidebar conversation history
  const selectHistoryItem = (item) => {
    setCurrentResponse(item);
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
      setAvatarState('idle');
    }
    // Auto speak selected history if not muted
    if (!muteTTS) {
      speakResponse(item.aiResponse);
    }
  };

  // Enrollment actions for CourseCard
  const handleEnrollCourse = async (courseId) => {
    try {
      const res = await axios.put('/progress/update', {
        courseId,
        completedModules: []
      });
      if (res.data.success) {
        // Refresh catalog progress list
        loadData();
      }
    } catch (err) {
      console.error('Enrollment failed:', err);
    }
  };

  const handleSelectCourse = (courseId) => {
    navigate('/catalog', { state: { openCourseId: courseId } });
  };

  // Keyboard text query fallback for accessibility
  const handleKeyboardSubmit = (e) => {
    if (e.key === 'Enter') {
      const text = e.target.value;
      if (text.trim()) {
        setTranscript(text);
        submitQuery(text);
        e.target.value = '';
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 grid-bg pb-12 text-slate-100 flex flex-col">
      <Navbar title="AI Voice Mentor" />

      {/* Main Container */}
      <div className="flex-1 px-6 sm:px-8 py-8 flex flex-col xl:flex-row gap-8 relative z-10">
        
        {/* Left Side: Voice Assistant Dashboard */}
        <div className="flex-1 flex flex-col gap-6">
          
          {/* Header Card */}
          <div className="glass-panel border-amber-500/20 bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950/20 rounded-3xl p-6 sm:p-8 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
            {/* Background design glow */}
            <div className="absolute right-0 top-0 w-72 h-72 bg-amber-500/5 blur-3xl rounded-full -mr-20 -mt-20"></div>
            
            <div className="text-center md:text-left space-y-2 max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-extrabold text-[10px] uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                Specialized LMS Personality
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight">
                Meet <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-200">EduFlick AI Voice Mentor</span>
              </h2>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                A premium voice mentor helping you navigate your learning paths, choose optimal courses, clarify software concepts, and accelerate your careers in tech.
              </p>
            </div>

            {/* Mute toggle button */}
            <button
              onClick={() => {
                setMuteTTS(!muteTTS);
                if (!muteTTS && isSpeaking) {
                  stopSpeaking();
                }
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all duration-200 cursor-pointer ${
                muteTTS 
                  ? 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300' 
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
              }`}
            >
              {muteTTS ? (
                <>
                  <VolumeX className="w-4 h-4" />
                  Voice Out: Muted
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4" />
                  Voice Out: Active
                </>
              )}
            </button>
          </div>

          {/* Interactive Assistant Console */}
          <div className="glass-panel border-slate-800 rounded-3xl p-8 flex flex-col items-center justify-center min-h-[460px] relative overflow-hidden bg-slate-950/40">
            {/* Visualizer backdrop */}
            <div className="absolute inset-0 radial-gradient-indigo opacity-30 pointer-events-none"></div>

            {/* AI Avatar */}
            <div className="relative z-10 flex flex-col items-center justify-center my-6">
              {/* Outer pulsing ring for speaking/listening */}
              <div className={`absolute w-36 h-36 rounded-full border-2 transition-all duration-500 ${
                avatarState === 'listening' ? 'border-amber-400 animate-ping opacity-70 scale-110' :
                avatarState === 'speaking' ? 'border-indigo-400 animate-pulse opacity-50 scale-105' :
                avatarState === 'thinking' ? 'border-yellow-400 animate-spin border-dashed duration-1000' :
                'border-slate-800 opacity-40 scale-100'
              }`}></div>

              {/* Middle glowing layer */}
              <div className={`absolute w-28 h-28 rounded-full blur-md opacity-30 transition-all duration-300 ${
                avatarState === 'listening' ? 'bg-amber-400' :
                avatarState === 'speaking' ? 'bg-indigo-400' :
                avatarState === 'thinking' ? 'bg-yellow-400 animate-pulse' :
                'bg-slate-800'
              }`}></div>

              {/* Inner Circle Avatar */}
              <div className={`relative w-24 h-24 rounded-full flex items-center justify-center border-4 shadow-2xl transition-all duration-300 ${
                avatarState === 'listening' ? 'bg-slate-900 border-amber-400 text-amber-400 scale-105' :
                avatarState === 'speaking' ? 'bg-slate-900 border-indigo-500 text-indigo-400 scale-105' :
                avatarState === 'thinking' ? 'bg-slate-900 border-yellow-400 text-yellow-400' :
                'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-650'
              }`}>
                {avatarState === 'listening' && (
                  <div className="flex gap-1.5 items-center justify-center h-full">
                    {/* Equalizer animation */}
                    <span className="w-1 bg-amber-400 h-6 rounded-full animate-[bounce_0.8s_infinite]"></span>
                    <span className="w-1 bg-amber-400 h-10 rounded-full animate-[bounce_0.6s_infinite_0.1s]"></span>
                    <span className="w-1 bg-amber-400 h-8 rounded-full animate-[bounce_0.7s_infinite_0.2s]"></span>
                    <span className="w-1 bg-amber-400 h-10 rounded-full animate-[bounce_0.6s_infinite_0.3s]"></span>
                    <span className="w-1 bg-amber-400 h-6 rounded-full animate-[bounce_0.8s_infinite_0.4s]"></span>
                  </div>
                )}
                {avatarState === 'speaking' && <Volume2 className="w-9 h-9 animate-bounce" />}
                {avatarState === 'thinking' && <Bot className="w-9 h-9 animate-pulse" />}
                {avatarState === 'idle' && <Bot className="w-9 h-9" />}
              </div>

              {/* State caption */}
              <span className={`text-[10px] uppercase tracking-widest font-black mt-6 px-3 py-1 rounded-full border transition-all duration-300 ${
                avatarState === 'listening' ? 'text-amber-400 bg-amber-500/10 border-amber-500/25 animate-pulse' :
                avatarState === 'speaking' ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/25' :
                avatarState === 'thinking' ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/25' :
                'text-slate-500 bg-slate-800/20 border-slate-800'
              }`}>
                {avatarState === 'listening' ? 'Listening...' :
                 avatarState === 'speaking' ? 'Speaking...' :
                 avatarState === 'thinking' ? 'Analyzing...' :
                 'Ready to Talk'}
              </span>
            </div>

            {/* Controls Box */}
            <div className="w-full max-w-xl text-center space-y-6 mt-4 relative z-10">
              <div className="flex justify-center gap-4">
                {/* Principal Mic Toggle button */}
                <button
                  onClick={toggleListening}
                  className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 cursor-pointer border ${
                    isListening
                      ? 'bg-red-500 hover:bg-red-600 text-white border-red-400 animate-pulse shadow-red-500/20'
                      : 'bg-gradient-to-tr from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 border-amber-400 shadow-amber-500/20 hover:scale-105'
                  }`}
                >
                  {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </button>

                {/* Stop Speech player button */}
                {isSpeaking && (
                  <button
                    onClick={stopSpeaking}
                    className="w-16 h-16 rounded-full flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 shadow-lg hover:scale-105 transition-all cursor-pointer"
                    title="Stop playback"
                  >
                    <VolumeX className="w-6 h-6 text-red-400" />
                  </button>
                )}
              </div>

              {/* Transcript Bubble */}
              {transcript && (
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 max-w-lg mx-auto shadow-inner text-center">
                  <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-500 block mb-1">Your Voice</span>
                  <p className="text-slate-300 text-xs italic">"{transcript}"</p>
                </div>
              )}

              {/* Text Query fallback input */}
              <div className="relative max-w-md mx-auto">
                <input
                  type="text"
                  onKeyDown={handleKeyboardSubmit}
                  placeholder="Or type a question and press Enter..."
                  className="w-full bg-slate-900/60 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/35 rounded-2xl pl-5 pr-12 py-3.5 text-xs text-white focus:outline-none placeholder-slate-650 transition-all duration-200"
                />
                <button
                  onClick={(e) => {
                    const input = e.target.previousSibling;
                    if (input && input.value) {
                      setTranscript(input.value);
                      submitQuery(input.value);
                      input.value = '';
                    }
                  }}
                  className="absolute right-3 top-3 p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-amber-400 cursor-pointer"
                >
                  <ArrowRight className="w-4.5 h-4.5" />
                </button>
              </div>
            </div>
          </div>

          {/* AI Advisor Response panel */}
          {currentResponse && (
            <div className="glass-panel border-amber-500/20 bg-slate-950/20 rounded-3xl p-6 sm:p-8 space-y-6 shadow-lg">
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800/85">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">AI Mentor Response</h4>
                    <p className="text-[10px] text-slate-500">
                      {new Date(currentResponse.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  {/* Replay audio button */}
                  <button
                    onClick={() => speakResponse(currentResponse.aiResponse)}
                    disabled={isSpeaking}
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all disabled:opacity-50 cursor-pointer"
                    title="Speak response"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Main Response text */}
              <div className="space-y-4">
                <p className="text-slate-200 text-xs leading-relaxed font-medium whitespace-pre-line">
                  {currentResponse.aiResponse}
                </p>
              </div>

              {/* Display suggestions if there are courses recommended */}
              {currentResponse.recommendedCourses && currentResponse.recommendedCourses.length > 0 && (
                <div className="pt-4 border-t border-slate-800/50 space-y-4">
                  <h4 className="text-[10px] uppercase font-black tracking-widest text-amber-400 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4" />
                    Recommended Path & Courses
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {currentResponse.recommendedCourses.map((c) => {
                      if (!c) return null;
                      
                      // Map to actual DB course if populated as ID reference
                      const actualCourse = dbCourses.find(dbC => (dbC._id || dbC.id).toString() === (c._id || c.id || c).toString()) || c;
                      const cId = actualCourse._id || actualCourse.id;
                      
                      return (
                        <div key={cId} className="scale-95 hover:scale-100 transition-all">
                          <CourseCard
                            course={actualCourse}
                            progress={progressMap[cId?.toString()]}
                            onEnroll={handleEnrollCourse}
                            onSelect={handleSelectCourse}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Side: Conversation History Sidebar */}
        <div className="w-full xl:w-80 flex flex-col gap-6 shrink-0">
          <div className="glass-panel border-slate-800 rounded-3xl p-6 flex flex-col h-[650px] overflow-hidden bg-slate-950/20">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2 mb-4 pb-3 border-b border-slate-800/80">
              <History className="w-4 h-4 text-amber-500" />
              Conversation History
            </h3>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
              {chatHistory.map((item, idx) => {
                const isSelected = currentResponse && currentResponse.timestamp === item.timestamp;
                return (
                  <div
                    key={idx}
                    onClick={() => selectHistoryItem(item)}
                    className={`p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? 'border-amber-500/35 bg-amber-500/10 text-white'
                        : 'border-slate-800/60 bg-slate-900/30 text-slate-400 hover:border-slate-700 hover:bg-slate-850/30 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <MessageSquare className={`w-4 h-4 shrink-0 mt-0.5 ${isSelected ? 'text-amber-400' : 'text-slate-500'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">
                          {item.userMessage}
                        </p>
                        <p className="text-[10px] text-slate-500 leading-snug mt-1.5 line-clamp-2">
                          {item.aiResponse}
                        </p>
                        
                        <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-800/30 text-[9px] text-slate-500">
                          <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                          {item.recommendedCourses && item.recommendedCourses.length > 0 && (
                            <span className="font-extrabold text-[8px] bg-amber-500/20 text-amber-400 border border-amber-500/10 px-1.5 py-0.5 rounded-full">
                              {item.recommendedCourses.length} Recommended
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {chatHistory.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center p-6">
                  <div className="w-12 h-12 rounded-full border border-slate-800 flex items-center justify-center text-slate-600 mb-3">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <p className="text-slate-500 text-xs font-medium">No conversation history yet.</p>
                  <p className="text-[10px] text-slate-650 mt-1 max-w-[180px]">Tap the microphone above to start chatting with your AI Mentor!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceMentor;
