'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/PageHeader';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Send,
  Paperclip,
  Image as ImageIcon,
  Users,
  Hash,
  Globe,
  Shield,
  Loader2,
  Plus,
  X,
  RefreshCw,
  UserPlus,
  CheckCircle,
  XCircle,
  Clock,
  FolderPlus,
} from 'lucide-react';
import { chatService, Channel, Message, User, ChannelCreationRequest, Attachment } from '@/lib/chat';
import { format } from 'date-fns';
import { io, Socket } from 'socket.io-client';
import ProtectedRoute from '@/components/ProtectedRoute';
import api from '@/lib/api';

// Component for displaying attachments
function AttachmentDisplay({ attachment, messageType, isGrid = false }: { attachment: Attachment; messageType: string; isGrid?: boolean }) {
  const isImage = messageType === 'IMAGE' || attachment.mime_type.startsWith('image/');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(true);

  useEffect(() => {
    if (isImage && !imageUrl) {
      chatService.downloadFile(attachment.id)
        .then((blob) => {
          const url = window.URL.createObjectURL(blob);
          setImageUrl(url);
          setImageLoading(false);
        })
        .catch((error) => {
          console.error('Failed to load image:', error);
          setImageLoading(false);
        });
    }
  }, [isImage, attachment.id, imageUrl]);

  if (isImage) {
    return (
      <div className={`relative ${isGrid ? 'w-full' : 'inline-block max-w-md'}`}>
        {imageLoading ? (
          <div className={`${isGrid ? 'aspect-square' : 'w-64 h-48'} bg-gray-100 rounded-lg flex items-center justify-center`}>
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : imageUrl ? (
          <>
            <img
              src={imageUrl}
              alt={attachment.file_name}
              className={`${isGrid ? 'w-full h-full object-cover' : 'max-w-full h-auto'} rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity`}
              onClick={() => {
                window.open(imageUrl, '_blank');
              }}
            />
            <button
              onClick={async () => {
                try {
                  const blob = await chatService.downloadFile(attachment.id);
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = attachment.file_name;
                  document.body.appendChild(a);
                  a.click();
                  window.URL.revokeObjectURL(url);
                  document.body.removeChild(a);
                } catch (error) {
                  console.error('Failed to download file:', error);
                  alert('Failed to download file. Please try again.');
                }
              }}
              className="absolute top-2 right-2 p-1.5 bg-black bg-opacity-50 rounded text-white hover:bg-opacity-70 transition-opacity"
              title="Download image"
            >
              <Paperclip className="w-3 h-3" />
            </button>
          </>
        ) : (
          <div className="px-3 py-2 bg-gray-100 rounded-lg">
            <span className="text-sm text-gray-600">Failed to load image</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={async () => {
        try {
          const blob = await chatService.downloadFile(attachment.id);
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = attachment.file_name;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        } catch (error) {
          console.error('Failed to download file:', error);
          alert('Failed to download file. Please try again.');
        }
      }}
      className={`${isGrid ? 'w-full' : 'inline-flex'} items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-left`}
    >
      <Paperclip className="w-4 h-4 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate">{attachment.file_name}</div>
        <div className="text-xs text-gray-500">
          {(attachment.file_size / 1024).toFixed(1)} KB
        </div>
      </div>
    </button>
  );
}

export default function ChatPage() {
  const { user, hasPermission } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState<'GLOBAL' | 'ROLE' | 'TEAM' | 'GROUP' | 'DM'>('GLOBAL');
  const [selectedDMUser, setSelectedDMUser] = useState<string>('');
  const [dmUsers, setDmUsers] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [channelRequests, setChannelRequests] = useState<ChannelCreationRequest[]>([]);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [selectedRequest, setSelectedRequest] = useState<ChannelCreationRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [targetRoleId, setTargetRoleId] = useState<string>('');
  const [targetTeamId, setTargetTeamId] = useState<string>('');
  const [requestedMembers, setRequestedMembers] = useState<string[]>([]);
  const [availableRoles, setAvailableRoles] = useState<any[]>([]);
  const [availableTeams, setAvailableTeams] = useState<any[]>([]);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [typingUsers, setTypingUsers] = useState<Map<string, any>>(new Map());
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<Map<string, string>>(new Map());
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedChannelRef = useRef<Channel | null>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!user) return;

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
    const wsUrl = apiUrl.replace('/api', '');

    const newSocket = io(wsUrl, {
      auth: { token },
      path: '/socket.io',
    });

    newSocket.on('connect', () => {
      setConnected(true);
      console.log('WebSocket connected');
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
      console.log('WebSocket disconnected');
    });

    newSocket.on('new_message', (message: Message) => {
      setMessages((prev) => {
        // Avoid duplicates
        if (prev.some((m) => m.id === message.id)) {
          return prev;
        }
        return [...prev, message]; // Add new message at the end (bottom)
      });
      scrollToBottom();
    });

    newSocket.on('user_typing', (data: { channel_id: string; user: any }) => {
      if (selectedChannelRef.current?.id === data.channel_id) {
        setTypingUsers((prev) => {
          const newMap = new Map(prev);
          newMap.set(data.user.id, data.user);
          return newMap;
        });
      }
    });

    newSocket.on('user_stopped_typing', (data: { channel_id: string; user_id: string }) => {
      if (selectedChannelRef.current?.id === data.channel_id) {
        setTypingUsers((prev) => {
          const newMap = new Map(prev);
          newMap.delete(data.user_id);
          return newMap;
        });
      }
    });

    newSocket.on('error', (error: { message: string }) => {
      console.error('WebSocket error:', error);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [user]);

  // Update ref when selected channel changes
  useEffect(() => {
    selectedChannelRef.current = selectedChannel;
  }, [selectedChannel]);

  // Load channels and users for DM
  const loadChannels = useCallback(async () => {
    try {
      const [channelsData, usersData] = await Promise.all([
        chatService.getChannels(),
        chatService.getUsersForDM(),
      ]);
      setChannels(channelsData);
      setDmUsers(usersData);
      setAvailableUsers(usersData);
      // Only set selected channel if we don't have one or if current one doesn't exist
      if (channelsData.length > 0) {
        setSelectedChannel((current) => {
          if (!current || !channelsData.find(c => c.id === current.id)) {
            return channelsData[0];
          }
          return current;
        });
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load channel requests
  const loadChannelRequests = useCallback(async () => {
    try {
      const requests = await chatService.getChannelRequests({
        status: 'PENDING',
        all: hasPermission('chat.channel.approve') ? true : false,
      });
      setChannelRequests(requests);
      setPendingRequestsCount(requests.length);
    } catch (error) {
      console.error('Failed to load channel requests:', error);
    }
  }, [hasPermission]);

  useEffect(() => {
    if (hasPermission('chat.channel.view')) {
      loadChannels();
      loadChannelRequests();
    }
  }, [hasPermission, loadChannels, loadChannelRequests]);

  // Load roles, teams, and users for channel creation
  useEffect(() => {
    const loadOptions = async () => {
      try {
        if (hasPermission('admin.roles.read')) {
          const rolesRes = await api.get('/admin/roles');
          setAvailableRoles(rolesRes.data);
        }
        if (hasPermission('admin.teams.read')) {
          const teamsRes = await api.get('/admin/teams');
          setAvailableTeams(teamsRes.data);
        }
        const usersRes = await chatService.getUsersForDM();
        setAvailableUsers(usersRes);
      } catch (error) {
        console.error('Failed to load options:', error);
      }
    };
    loadOptions();
  }, [hasPermission]);

  // Load messages when channel changes
  useEffect(() => {
    if (!selectedChannel || !socket) return;

    const loadMessages = async () => {
      try {
        const data = await chatService.getMessages(selectedChannel.id);
        setMessages(data); // Keep newest at bottom (no reverse)
        scrollToBottom();

        // Join channel via WebSocket
        socket.emit('join_channel', { channel_id: selectedChannel.id });
      } catch (error) {
        console.error('Failed to load messages:', error);
      }
    };

    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChannel?.id, socket]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!selectedChannel || sending) return;
    if (!messageInput.trim() && selectedFiles.length === 0) return;

    setSending(true);
    try {
      if (selectedFiles.length > 0) {
        // Upload all files in one message with optional text
        await chatService.uploadMultipleFiles(
          selectedChannel.id,
          selectedFiles,
          messageInput.trim() || undefined
        );

        // Clear files and previews
        setSelectedFiles([]);
        setFilePreviews(new Map());
      } else {
        // Send text message only
        await chatService.sendMessage({
          channel_id: selectedChannel.id,
          content: messageInput.trim(),
          message_type: 'TEXT',
        });
      }
      setMessageInput('');
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newFiles = Array.from(files);
    
    // Check for duplicates by name and size
    setSelectedFiles((prev) => {
      const existing = new Set(prev.map(f => `${f.name}-${f.size}`));
      const unique = newFiles.filter(f => !existing.has(`${f.name}-${f.size}`));
      return [...prev, ...unique];
    });

    // Create previews for images
    newFiles.forEach((file) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFilePreviews((prev) => {
            const updated = new Map(prev);
            updated.set(file.name, reader.result as string);
            return updated;
          });
        };
        reader.readAsDataURL(file);
      }
    });

    // Clear input so same files can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (fileName: string) => {
    setSelectedFiles((prev) => prev.filter((f) => f.name !== fileName));
    setFilePreviews((prev) => {
      const updated = new Map(prev);
      updated.delete(fileName);
      return updated;
    });
  };

  const handleCreateChannel = async () => {
    if (creating) return;
    if (newChannelType !== 'DM' && !newChannelName.trim()) return;
    if (newChannelType === 'DM' && !selectedDMUser) return;

    setCreating(true);
    try {
      let newChannel: Channel;
      
      if (newChannelType === 'DM') {
        // Use the new startDM endpoint
        newChannel = await chatService.startDM(selectedDMUser);
      } else {
        newChannel = await chatService.createChannel({
          name: newChannelName.trim(),
          type: newChannelType,
          target_role_id: newChannelType === 'ROLE' ? targetRoleId : undefined,
          target_team_id: newChannelType === 'TEAM' ? targetTeamId : undefined,
          requested_members: newChannelType === 'GROUP' ? requestedMembers : undefined,
        });
      }
      
      // Reload all channels to include the new one and any others that might have been created
      await loadChannels();
      
      // Select the newly created channel
      setSelectedChannel(newChannel);
      
      // Close modal and reset form
      setShowCreateModal(false);
      setNewChannelName('');
      setNewChannelType('GLOBAL');
      setSelectedDMUser('');
      setTargetRoleId('');
      setTargetTeamId('');
      setRequestedMembers([]);
    } catch (error: any) {
      console.error('Failed to create channel:', error);
      const errorMsg = error.response?.data?.error || 'Failed to create channel. Please try again.';
      if (errorMsg.includes('Insufficient hierarchy') || errorMsg.includes('permission')) {
        alert(`${errorMsg}\n\nYou may need to request channel creation instead.`);
        setShowCreateModal(false);
        setShowRequestModal(true);
      } else {
        alert(errorMsg);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleRequestChannel = async () => {
    if (requesting) return;
    if (!newChannelName.trim()) return;
    if (newChannelType === 'DM') {
      alert('Direct messages are created automatically. Please use the "Create Channel" option.');
      return;
    }
    if (newChannelType === 'ROLE' && !targetRoleId) {
      alert('Please select a role for ROLE channels');
      return;
    }
    if (newChannelType === 'TEAM' && !targetTeamId) {
      alert('Please select a team for TEAM channels');
      return;
    }
    if (newChannelType === 'GROUP' && requestedMembers.length === 0) {
      alert('Please select at least one member for GROUP channels');
      return;
    }

    setRequesting(true);
    try {
      await chatService.createChannelRequest({
        channel_name: newChannelName.trim(),
        channel_type: newChannelType as 'GLOBAL' | 'ROLE' | 'TEAM' | 'GROUP',
        target_role_id: newChannelType === 'ROLE' ? targetRoleId : undefined,
        target_team_id: newChannelType === 'TEAM' ? targetTeamId : undefined,
        requested_members: newChannelType === 'GROUP' ? requestedMembers : undefined,
      });
      
      alert('Channel creation request submitted successfully! It will be reviewed by a manager or admin.');
      
      // Reload requests
      await loadChannelRequests();
      
      // Close modal and reset form
      setShowRequestModal(false);
      setNewChannelName('');
      setNewChannelType('GLOBAL');
      setTargetRoleId('');
      setTargetTeamId('');
      setRequestedMembers([]);
    } catch (error: any) {
      console.error('Failed to request channel:', error);
      alert(error.response?.data?.error || 'Failed to submit request. Please try again.');
    } finally {
      setRequesting(false);
    }
  };

  const handleApproveRequest = async () => {
    if (!selectedRequest || approving) return;

    setApproving(true);
    try {
      await chatService.approveChannelRequest(selectedRequest.id, reviewNotes);
      alert('Channel request approved and channel created successfully!');
      await loadChannels();
      await loadChannelRequests();
      setShowApprovalModal(false);
      setSelectedRequest(null);
      setReviewNotes('');
    } catch (error: any) {
      console.error('Failed to approve request:', error);
      alert(error.response?.data?.error || 'Failed to approve request. Please try again.');
    } finally {
      setApproving(false);
    }
  };

  const handleRejectRequest = async () => {
    if (!selectedRequest || rejecting) return;
    if (!reviewNotes.trim()) {
      alert('Please provide review notes when rejecting a request.');
      return;
    }

    setRejecting(true);
    try {
      await chatService.rejectChannelRequest(selectedRequest.id, reviewNotes);
      alert('Channel request rejected.');
      await loadChannelRequests();
      setShowApprovalModal(false);
      setSelectedRequest(null);
      setReviewNotes('');
    } catch (error: any) {
      console.error('Failed to reject request:', error);
      alert(error.response?.data?.error || 'Failed to reject request. Please try again.');
    } finally {
      setRejecting(false);
    }
  };

  const handleTyping = () => {
    if (!selectedChannel || !socket) return;

    // Emit typing start
    socket.emit('typing_start', { channel_id: selectedChannel.id });

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      if (socket) {
        socket.emit('typing_stop', { channel_id: selectedChannel.id });
      }
    }, 3000);
  };

  const getChannelIcon = (type: string) => {
    switch (type) {
      case 'GLOBAL':
        return <Globe className="w-4 h-4" />;
      case 'ROLE':
        return <Shield className="w-4 h-4" />;
      case 'TEAM':
        return <Users className="w-4 h-4" />;
      case 'GROUP':
        return <FolderPlus className="w-4 h-4" />;
      default:
        return <Hash className="w-4 h-4" />;
    }
  };

  const groupedChannels = {
    DM: channels.filter((c) => c.type === 'DM'),
    GLOBAL: channels.filter((c) => c.type === 'GLOBAL'),
    ROLE: channels.filter((c) => c.type === 'ROLE'),
    TEAM: channels.filter((c) => c.type === 'TEAM'),
    GROUP: channels.filter((c) => c.type === 'GROUP'),
  };

  if (loading) {
    return (
      <ProtectedRoute requiredPermission="chat.channel.view">
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredPermission="chat.channel.view">
      <div className="min-h-screen bg-gray-50">
        <div className="h-screen flex flex-col">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex-1 m-4">
            <div className="flex h-full">
              {/* Channel List */}
              <div className="w-64 border-r border-gray-200 flex flex-col">
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Channels</h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setLoading(true);
                        loadChannels();
                      }}
                      className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                      title="Refresh channels"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    {hasPermission('chat.channel.request') && (
                      <button
                        onClick={() => setShowRequestModal(true)}
                        className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors relative"
                        title="Request channel"
                      >
                        <UserPlus className="w-5 h-5" />
                        {pendingRequestsCount > 0 && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                            {pendingRequestsCount}
                          </span>
                        )}
                      </button>
                    )}
                    {hasPermission('chat.channel.create') && (
                      <button
                        onClick={() => setShowCreateModal(true)}
                        className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        title="Create channel"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    )}
                    {hasPermission('chat.channel.approve') && pendingRequestsCount > 0 && (
                      <button
                        onClick={() => {
                          setSelectedRequest(channelRequests[0]);
                          setShowApprovalModal(true);
                        }}
                        className="p-1.5 text-orange-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors relative"
                        title="Review requests"
                      >
                        <Clock className="w-5 h-5" />
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 text-white text-xs rounded-full flex items-center justify-center">
                          {pendingRequestsCount}
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {/* Direct Messages */}
                  {groupedChannels.DM.length > 0 && (
                    <div className="p-2">
                      <div className="text-xs font-semibold text-gray-500 uppercase mb-2 px-2">
                        Direct Messages
                      </div>
                      {groupedChannels.DM.map((channel) => (
                        <button
                          key={channel.id}
                          onClick={() => setSelectedChannel(channel)}
                          className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg mb-1 text-left transition-colors ${
                            selectedChannel?.id === channel.id
                              ? 'bg-primary-50 text-primary-700'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <Users className="w-4 h-4" />
                          <span className="flex-1 truncate">{channel.name}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Global Channels */}
                  {groupedChannels.GLOBAL.length > 0 && (
                    <div className="p-2">
                      <div className="text-xs font-semibold text-gray-500 uppercase mb-2 px-2">
                        Global
                      </div>
                      {groupedChannels.GLOBAL.map((channel) => (
                        <button
                          key={channel.id}
                          onClick={() => setSelectedChannel(channel)}
                          className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg mb-1 text-left transition-colors ${
                            selectedChannel?.id === channel.id
                              ? 'bg-primary-50 text-primary-700'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {getChannelIcon(channel.type)}
                          <span className="flex-1 truncate">{channel.name}</span>
                          {channel.member_count && (
                            <span className="text-xs text-gray-500">
                              {channel.member_count}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Role Channels */}
                  {groupedChannels.ROLE.length > 0 && (
                    <div className="p-2">
                      <div className="text-xs font-semibold text-gray-500 uppercase mb-2 px-2">
                        Role
                      </div>
                      {groupedChannels.ROLE.map((channel) => (
                        <button
                          key={channel.id}
                          onClick={() => setSelectedChannel(channel)}
                          className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg mb-1 text-left transition-colors ${
                            selectedChannel?.id === channel.id
                              ? 'bg-primary-50 text-primary-700'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {getChannelIcon(channel.type)}
                          <span className="flex-1 truncate">{channel.name}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Team Channels */}
                  {groupedChannels.TEAM.length > 0 && (
                    <div className="p-2">
                      <div className="text-xs font-semibold text-gray-500 uppercase mb-2 px-2">
                        Team
                      </div>
                      {groupedChannels.TEAM.map((channel) => (
                        <button
                          key={channel.id}
                          onClick={() => setSelectedChannel(channel)}
                          className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg mb-1 text-left transition-colors ${
                            selectedChannel?.id === channel.id
                              ? 'bg-primary-50 text-primary-700'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {getChannelIcon(channel.type)}
                          <span className="flex-1 truncate">{channel.name}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Group Channels */}
                  {groupedChannels.GROUP.length > 0 && (
                    <div className="p-2">
                      <div className="text-xs font-semibold text-gray-500 uppercase mb-2 px-2">
                        Groups
                      </div>
                      {groupedChannels.GROUP.map((channel) => (
                        <button
                          key={channel.id}
                          onClick={() => setSelectedChannel(channel)}
                          className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg mb-1 text-left transition-colors ${
                            selectedChannel?.id === channel.id
                              ? 'bg-primary-50 text-primary-700'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {getChannelIcon(channel.type)}
                          <span className="flex-1 truncate">{channel.name}</span>
                          {channel.member_count && (
                            <span className="text-xs text-gray-500">
                              {channel.member_count}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Connection Status */}
                <div className="p-2 border-t border-gray-200">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        connected ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    />
                    {connected ? 'Connected' : 'Disconnected'}
                  </div>
                </div>
              </div>

              {/* Message Area */}
              <div className="flex-1 flex flex-col">
                {selectedChannel ? (
                  <>
                    {/* Channel Header */}
                    <div className="p-4 border-b border-gray-200">
                      <div className="flex items-center gap-2">
                        {getChannelIcon(selectedChannel.type)}
                        <h3 className="text-lg font-semibold text-gray-900">
                          {selectedChannel.name || 'Direct Message'}
                        </h3>
                        {selectedChannel.status === 'PENDING' && (
                          <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                            Pending
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col">
                      <AnimatePresence>
                        {messages.map((message) => (
                          <motion.div
                            key={message.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex gap-3"
                          >
                            <div className="flex-shrink-0">
                              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                                <span className="text-primary-700 text-sm font-medium">
                                  {message.sender?.first_name?.[0] || 'U'}
                                </span>
                              </div>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-baseline gap-2 mb-1">
                                <span className="font-medium text-gray-900">
                                  {message.sender?.first_name} {message.sender?.last_name}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {format(new Date(message.created_at), 'MMM d, h:mm a')}
                                </span>
                              </div>
                              {message.content && (
                                <div className="text-gray-700 mb-2">{message.content}</div>
                              )}
                              {message.attachments && message.attachments.length > 0 && (
                                <div className="mt-2">
                                  {message.attachments.length === 1 ? (
                                    <AttachmentDisplay
                                      attachment={message.attachments[0]}
                                      messageType={message.message_type}
                                    />
                                  ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-3xl">
                                      {message.attachments.map((attachment) => (
                                        <AttachmentDisplay
                                          key={attachment.id}
                                          attachment={attachment}
                                          messageType={message.message_type}
                                          isGrid={true}
                                        />
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                      
                      {/* Typing Indicators */}
                      {typingUsers.size > 0 && (
                        <div className="text-sm text-gray-500 italic py-2">
                          {Array.from(typingUsers.values())
                            .map((u) => `${u.first_name} ${u.last_name}`)
                            .join(', ')}{' '}
                          {typingUsers.size === 1 ? 'is' : 'are'} typing...
                        </div>
                      )}
                      
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Message Input */}
                    <div className="p-4 border-t border-gray-200">
                    {/* File Previews */}
                    {selectedFiles.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs text-gray-500 mb-2 px-1">
                          {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected
                        </div>
                        <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                          {selectedFiles.map((file, index) => {
                            const preview = filePreviews.get(file.name);
                            const isImage = file.type.startsWith('image/');
                            return (
                              <div
                                key={`${file.name}-${index}`}
                                className="relative group bg-gray-50 rounded-lg border border-gray-200 overflow-hidden"
                              >
                                <button
                                  onClick={() => handleRemoveFile(file.name)}
                                  className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors z-10 opacity-0 group-hover:opacity-100"
                                  title="Remove file"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                                {isImage && preview ? (
                                  <div className="aspect-square">
                                    <img
                                      src={preview}
                                      alt="Preview"
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                ) : (
                                  <div className="aspect-square flex flex-col items-center justify-center p-2">
                                    <Paperclip className="w-8 h-8 text-gray-400 mb-1" />
                                    <p className="text-xs text-gray-600 text-center truncate w-full px-1" title={file.name}>
                                      {file.name}
                                    </p>
                                  </div>
                                )}
                                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs px-1 py-0.5 truncate">
                                  {(file.size / 1024).toFixed(1)} KB
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                      <div className="flex gap-2">
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileSelect}
                          className="hidden"
                          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
                          multiple
                        />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={sending}
                          className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                          title="Attach files (multiple files supported)"
                        >
                          <Paperclip className="w-5 h-5" />
                        </button>
                        <input
                          type="text"
                          value={messageInput}
                          onChange={(e) => {
                            setMessageInput(e.target.value);
                            handleTyping();
                          }}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage();
                              if (socket && selectedChannel) {
                                socket.emit('typing_stop', { channel_id: selectedChannel.id });
                              }
                            }
                          }}
                          placeholder={selectedFiles.length > 0 ? "Add a caption (optional)..." : "Type a message..."}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                          disabled={sending}
                        />
                        <button
                          onClick={handleSendMessage}
                          disabled={sending || (!messageInput.trim() && selectedFiles.length === 0)}
                          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {sending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                      <p>Select a channel to start chatting</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Channel Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">Create New Channel</h3>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewChannelName('');
                    setNewChannelType('GLOBAL');
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Channel Name
                  </label>
                  <input
                    type="text"
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    placeholder="Enter channel name"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={creating}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Channel Type
                  </label>
                  <select
                    value={newChannelType}
                    onChange={(e) => {
                      setNewChannelType(e.target.value as 'GLOBAL' | 'ROLE' | 'TEAM' | 'DM');
                      setSelectedDMUser('');
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={creating}
                  >
                    <option value="GLOBAL">Global (All Users)</option>
                    <option value="ROLE">Role-Based</option>
                    <option value="TEAM">Team-Based</option>
                    <option value="GROUP">Group (Custom Members)</option>
                    <option value="DM">Direct Message</option>
                  </select>
                  {newChannelType === 'DM' ? (
                    <div className="mt-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select User
                      </label>
                      <select
                        value={selectedDMUser}
                        onChange={(e) => setSelectedDMUser(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={creating}
                      >
                        <option value="">Choose a user...</option>
                        {dmUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.first_name} {u.last_name} ({u.email})
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : newChannelType === 'ROLE' ? (
                    <div className="mt-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Role
                      </label>
                      <select
                        value={targetRoleId}
                        onChange={(e) => setTargetRoleId(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={creating}
                      >
                        <option value="">Choose a role...</option>
                        {availableRoles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : newChannelType === 'TEAM' ? (
                    <div className="mt-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Team
                      </label>
                      <select
                        value={targetTeamId}
                        onChange={(e) => setTargetTeamId(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={creating}
                      >
                        <option value="">Choose a team...</option>
                        {availableTeams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : newChannelType === 'GROUP' ? (
                    <div className="mt-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Members
                      </label>
                      <select
                        multiple
                        value={requestedMembers}
                        onChange={(e) => {
                          const selected = Array.from(e.target.selectedOptions, option => option.value);
                          setRequestedMembers(selected);
                        }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[120px]"
                        disabled={creating}
                      >
                        {availableUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.first_name} {u.last_name} ({u.email})
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-gray-500">
                        Hold Ctrl/Cmd to select multiple members
                      </p>
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-gray-500">
                      {newChannelType === 'GLOBAL' && 'Visible to all active users'}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3 mt-6">
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setNewChannelName('');
                      setNewChannelType('GLOBAL');
                      setTargetRoleId('');
                      setTargetTeamId('');
                      setRequestedMembers([]);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    disabled={creating}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateChannel}
                    disabled={creating || (newChannelType !== 'DM' && !newChannelName.trim()) || (newChannelType === 'DM' && !selectedDMUser) || (newChannelType === 'ROLE' && !targetRoleId) || (newChannelType === 'TEAM' && !targetTeamId) || (newChannelType === 'GROUP' && requestedMembers.length === 0)}
                    className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Channel'
                    )}
                  </button>
                </div>
                {hasPermission('chat.channel.request') && newChannelType !== 'DM' && (
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setShowRequestModal(true);
                    }}
                    className="w-full px-4 py-2 border border-primary-600 text-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
                    disabled={creating}
                  >
                    Or Request Channel Creation Instead
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Request Channel Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">Request Channel Creation</h3>
                <button
                  onClick={() => {
                    setShowRequestModal(false);
                    setNewChannelName('');
                    setNewChannelType('GLOBAL');
                    setTargetRoleId('');
                    setTargetTeamId('');
                    setRequestedMembers([]);
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Channel Name *
                  </label>
                  <input
                    type="text"
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    placeholder="Enter channel name"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={requesting}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Channel Type *
                  </label>
                  <select
                    value={newChannelType}
                    onChange={(e) => {
                      setNewChannelType(e.target.value as 'GLOBAL' | 'ROLE' | 'TEAM' | 'GROUP');
                      setTargetRoleId('');
                      setTargetTeamId('');
                      setRequestedMembers([]);
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={requesting}
                  >
                    <option value="GLOBAL">Global (All Users)</option>
                    <option value="ROLE">Role-Based</option>
                    <option value="TEAM">Team-Based</option>
                    <option value="GROUP">Group (Custom Members)</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Note: Direct messages cannot be requested. Use &quot;Create Channel&quot; to start a DM.
                  </p>
                  {newChannelType === 'ROLE' && (
                    <div className="mt-2">
                      <select
                        value={targetRoleId}
                        onChange={(e) => setTargetRoleId(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={requesting}
                      >
                        <option value="">Choose a role...</option>
                        {availableRoles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {newChannelType === 'TEAM' && (
                    <div className="mt-2">
                      <select
                        value={targetTeamId}
                        onChange={(e) => setTargetTeamId(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={requesting}
                      >
                        <option value="">Choose a team...</option>
                        {availableTeams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {newChannelType === 'GROUP' && (
                    <div className="mt-2">
                      <select
                        multiple
                        value={requestedMembers}
                        onChange={(e) => {
                          const selected = Array.from(e.target.selectedOptions, option => option.value);
                          setRequestedMembers(selected);
                        }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[120px]"
                        disabled={requesting}
                      >
                        {availableUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.first_name} {u.last_name} ({u.email})
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-gray-500">
                        Hold Ctrl/Cmd to select multiple members
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowRequestModal(false);
                    setNewChannelName('');
                    setNewChannelType('GLOBAL');
                    setTargetRoleId('');
                    setTargetTeamId('');
                    setRequestedMembers([]);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={requesting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleRequestChannel}
                  disabled={requesting || !newChannelName.trim()}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {requesting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Request'
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Approval Modal */}
      {showApprovalModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">Review Channel Request</h3>
                <button
                  onClick={() => {
                    setShowApprovalModal(false);
                    setSelectedRequest(null);
                    setReviewNotes('');
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Channel Name</label>
                  <p className="text-gray-900">{selectedRequest.channel_name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Channel Type</label>
                  <p className="text-gray-900">{selectedRequest.channel_type}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Requested By</label>
                  <p className="text-gray-900">
                    {selectedRequest.requester?.first_name} {selectedRequest.requester?.last_name} ({selectedRequest.requester?.email})
                  </p>
                </div>
                {selectedRequest.target_role && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Target Role</label>
                    <p className="text-gray-900">{selectedRequest.target_role.name}</p>
                  </div>
                )}
                {selectedRequest.target_team && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Target Team</label>
                    <p className="text-gray-900">{selectedRequest.target_team.name}</p>
                  </div>
                )}
                {selectedRequest.requested_members.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Requested Members</label>
                    <p className="text-gray-900">{selectedRequest.requested_members.length} member(s)</p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Review Notes</label>
                  <textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Optional notes for approval, required for rejection"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[100px]"
                    disabled={approving || rejecting}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleRejectRequest}
                  disabled={rejecting || approving || !reviewNotes.trim()}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {rejecting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Rejecting...
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      Reject
                    </>
                  )}
                </button>
                <button
                  onClick={handleApproveRequest}
                  disabled={approving || rejecting}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {approving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Approving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Approve
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </ProtectedRoute>
  );
}

