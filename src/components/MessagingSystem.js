// src/components/MessagingSystem.js
import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  X,
  User,
  Clock,
  Search,
  Package,
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  Paperclip,
  Archive,
  Trash2,
  Star
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_URL = 'http://localhost:5000/api';

function MessagingSystem({ isOpen, onClose, initialRecipient = null, listingContext = null }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('inbox');
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const messagesEndRef = useRef(null);
  const [refreshInterval, setRefreshInterval] = useState(null);

  // Load conversations on mount
  useEffect(() => {
    if (isOpen) {
      fetchConversations();
      // Set up polling for new messages
      const interval = setInterval(fetchConversations, 10000); // Poll every 10 seconds
      setRefreshInterval(interval);
    }
    
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [isOpen]);

  // Handle initial recipient
  useEffect(() => {
    if (initialRecipient && isOpen) {
      startNewConversation(initialRecipient, listingContext);
    }
  }, [initialRecipient, isOpen]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversations = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/messages/conversations`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    }
  };

  const fetchMessages = async (conversationId) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/messages/conversation/${conversationId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
        // Mark messages as read
        markAsRead(conversationId);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (conversationId) => {
    try {
      const token = localStorage.getItem('authToken');
      await fetch(`${API_URL}/messages/conversation/${conversationId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (error) {
      console.error('Failed to mark messages as read:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    const messageData = {
      to_user_id: selectedConversation.other_user_id,
      message: newMessage,
      listing_id: selectedConversation.listing_id || null
    };

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(messageData)
      });

      if (response.ok) {
        const data = await response.json();
        // Add message to local state immediately for better UX
        setMessages(prev => [...prev, {
          id: data.id,
          from_user_id: user.id,
          from_username: user.username,
          to_user_id: selectedConversation.other_user_id,
          message: newMessage,
          created_at: new Date().toISOString(),
          is_read: false
        }]);
        setNewMessage('');
        // Refresh conversations to update last message
        fetchConversations();
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      showNotification('Failed to send message', 'error');
    }
  };

  const startNewConversation = (recipient, listing = null) => {
    const newConv = {
      other_user_id: recipient.id,
      other_username: recipient.username,
      listing_id: listing?.id || null,
      listing_name: listing?.card_name || null,
      last_message: '',
      last_message_time: new Date().toISOString(),
      unread_count: 0,
      isNew: true
    };
    
    setSelectedConversation(newConv);
    setMessages([]);
  };

  const deleteConversation = async (conversationId) => {
    if (!window.confirm('Are you sure you want to delete this conversation?')) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/messages/conversation/${conversationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        showNotification('Conversation deleted', 'success');
        fetchConversations();
        if (selectedConversation?.id === conversationId) {
          setSelectedConversation(null);
          setMessages([]);
        }
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      showNotification('Failed to delete conversation', 'error');
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 3000);
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-AU', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
    }
  };

  const filteredConversations = conversations.filter(conv => {
    if (activeTab === 'archived' && !conv.is_archived) return false;
    if (activeTab === 'inbox' && conv.is_archived) return false;
    
    if (searchTerm) {
      return conv.other_username.toLowerCase().includes(searchTerm.toLowerCase()) ||
             (conv.listing_name && conv.listing_name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    return true;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      {/* Notification */}
      {notification.show && (
        <div className={`absolute top-5 right-5 px-5 py-3 rounded-lg flex items-center gap-2 z-60 shadow-lg ${
          notification.type === 'error' ? 'bg-red-500' : 'bg-green-500'
        } text-white`}>
          {notification.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
          {notification.message}
        </div>
      )}

      <div className="bg-white rounded-xl max-w-6xl w-full h-[80vh] flex overflow-hidden">
        {/* Conversations List */}
        <div className="w-1/3 border-r flex flex-col">
          <div className="p-4 border-b">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <MessageSquare size={20} />
                Messages
              </h2>
              <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                <X size={20} />
              </button>
            </div>
            
            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
              />
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('inbox')}
                className={`flex-1 py-1 px-2 rounded text-sm font-medium transition ${
                  activeTab === 'inbox' 
                    ? 'bg-blue-100 text-blue-600' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Inbox ({conversations.filter(c => !c.is_archived && c.unread_count > 0).length})
              </button>
              <button
                onClick={() => setActiveTab('archived')}
                className={`flex-1 py-1 px-2 rounded text-sm font-medium transition ${
                  activeTab === 'archived' 
                    ? 'bg-blue-100 text-blue-600' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Archived
              </button>
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <MessageSquare size={48} className="mx-auto mb-4 opacity-30" />
                <p>No conversations yet</p>
              </div>
            ) : (
              filteredConversations.map(conv => (
                <div
                  key={conv.id}
                  onClick={() => {
                    setSelectedConversation(conv);
                    fetchMessages(conv.id);
                  }}
                  className={`p-3 border-b hover:bg-gray-50 cursor-pointer transition ${
                    selectedConversation?.id === conv.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                      <User size={20} className="text-gray-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="font-semibold text-sm truncate">
                          {conv.other_username}
                        </h3>
                        <span className="text-xs text-gray-500">
                          {formatTime(conv.last_message_time)}
                        </span>
                      </div>
                      {conv.listing_name && (
                        <div className="flex items-center gap-1 text-xs text-blue-600 mb-1">
                          <Package size={12} />
                          <span className="truncate">{conv.listing_name}</span>
                        </div>
                      )}
                      <p className="text-sm text-gray-600 truncate">
                        {conv.last_message || 'Start a conversation...'}
                      </p>
                      {conv.unread_count > 0 && (
                        <span className="inline-block mt-1 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                          {conv.unread_count} new
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              {/* Header */}
              <div className="p-4 border-b bg-gray-50">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setSelectedConversation(null);
                        setMessages([]);
                      }}
                      className="md:hidden p-1 hover:bg-gray-200 rounded"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                      <User size={20} className="text-gray-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{selectedConversation.other_username}</h3>
                      {selectedConversation.listing_name && (
                        <div className="flex items-center gap-1 text-xs text-gray-600">
                          <Package size={12} />
                          <span>Re: {selectedConversation.listing_name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => deleteConversation(selectedConversation.id)}
                      className="p-2 hover:bg-gray-200 rounded"
                      title="Delete conversation"
                    >
                      <Trash2 size={18} />
                    </button>
                    <button
                      className="p-2 hover:bg-gray-200 rounded"
                      title="Archive conversation"
                    >
                      <Archive size={18} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
                    <p>Loading messages...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map(msg => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.from_user_id === user.id ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[70%] ${
                          msg.from_user_id === user.id 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-100 text-gray-900'
                        } rounded-lg px-4 py-2`}>
                          <p className="text-sm">{msg.message}</p>
                          <p className={`text-xs mt-1 ${
                            msg.from_user_id === user.id ? 'text-blue-100' : 'text-gray-500'
                          }`}>
                            {formatTime(msg.created_at)}
                            {msg.from_user_id === user.id && msg.is_read && (
                              <span className="ml-2">✓✓</span>
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Message Input */}
              <div className="p-4 border-t bg-gray-50">
                <div className="flex gap-2">
                  <button className="p-2 hover:bg-gray-200 rounded">
                    <Paperclip size={20} className="text-gray-600" />
                  </button>
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Type your message..."
                    className="flex-1 px-3 py-2 border rounded-lg"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition"
                  >
                    <Send size={20} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <MessageSquare size={64} className="mx-auto mb-4 opacity-30" />
                <p className="text-lg">Select a conversation to start messaging</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MessagingSystem;