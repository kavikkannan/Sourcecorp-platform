'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/PageHeader';
import { motion, AnimatePresence } from 'framer-motion';
import { Megaphone, Building2, TrendingUp, Calendar, User, Search, Filter, ChevronLeft, ChevronRight, X } from 'lucide-react';
import api, { API_URL } from '@/lib/api';
import { format } from 'date-fns';

interface Announcement {
  id: string;
  title: string;
  content: string;
  is_active: boolean;
  category: 'GENERAL' | 'BANK_UPDATES' | 'SALES_REPORT';
  image_path?: string | null;
  author_name: string;
  created_at: string;
}

export default function AnnouncementsPage() {
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'BANK_UPDATES' | 'SALES_REPORT' | 'ALL'>('ALL');
  const [allAnnouncements, setAllAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [navigationAnnouncements, setNavigationAnnouncements] = useState<Announcement[]>([]);
  const [loadingNavigation, setLoadingNavigation] = useState(false);
  const itemsPerPage = 12;

  useEffect(() => {
    fetchAllAnnouncements();
  }, []);

  const fetchAllAnnouncements = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/announcements', { 
        params: { activeOnly: 'true' } 
      });
      const data = response.data;
      
      // Handle both new format (with announcements array) and old format (direct array)
      let announcementsList: Announcement[] = [];
      if (data?.announcements && Array.isArray(data.announcements)) {
        announcementsList = data.announcements;
      } else if (Array.isArray(data)) {
        announcementsList = data;
      }
      
      // Filter active announcements
      const activeAnnouncements = announcementsList.filter((a: Announcement) => a.is_active);
      setAllAnnouncements(activeAnnouncements);
    } catch (error) {
      console.error('Failed to fetch announcements:', error);
      setAllAnnouncements([]);
    } finally {
      setLoading(false);
    }
  };

  // Calculate category counts from all announcements
  const categoryCounts = useMemo(() => {
    if (!Array.isArray(allAnnouncements)) {
      return {
        ALL: 0,
        GENERAL: 0,
        BANK_UPDATES: 0,
        SALES_REPORT: 0,
      };
    }
    return {
      ALL: allAnnouncements.length,
      GENERAL: allAnnouncements.filter(a => a.category === 'GENERAL').length,
      BANK_UPDATES: allAnnouncements.filter(a => a.category === 'BANK_UPDATES').length,
      SALES_REPORT: allAnnouncements.filter(a => a.category === 'SALES_REPORT').length,
    };
  }, [allAnnouncements]);

  // Filter all announcements
  const filteredAnnouncements = useMemo(() => {
    if (!Array.isArray(allAnnouncements)) return [];
    
    let filtered = [...allAnnouncements];
    
    // Filter by category
    if (activeTab !== 'ALL') {
      filtered = filtered.filter((a) => a.category === activeTab);
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((a) => 
        a.title?.toLowerCase().includes(query) ||
        a.content?.toLowerCase().includes(query) ||
        a.author_name?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [allAnnouncements, activeTab, searchQuery]);

  // Paginate filtered announcements
  const paginatedAnnouncements = useMemo(() => {
    if (!Array.isArray(filteredAnnouncements)) return [];
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredAnnouncements.slice(startIndex, endIndex);
  }, [filteredAnnouncements, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredAnnouncements.length / itemsPerPage);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'BANK_UPDATES':
        return <Building2 className="w-5 h-5" />;
      case 'SALES_REPORT':
        return <TrendingUp className="w-5 h-5" />;
      default:
        return <Megaphone className="w-5 h-5" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'BANK_UPDATES':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'SALES_REPORT':
        return 'bg-green-100 text-green-700 border-green-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'BANK_UPDATES':
        return 'Bank Updates';
      case 'SALES_REPORT':
        return 'Sales Report';
      default:
        return 'General';
    }
  };

  const handleCardClick = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement);
    setModalOpen(true);
    // Use filtered announcements for navigation
    setNavigationAnnouncements(filteredAnnouncements);
  };

  const handlePrevious = useCallback(() => {
    if (!selectedAnnouncement || navigationAnnouncements.length === 0) return;
    const currentIndex = navigationAnnouncements.findIndex(a => a.id === selectedAnnouncement.id);
    if (currentIndex > 0) {
      const prevAnnouncement = navigationAnnouncements[currentIndex - 1];
      setSelectedAnnouncement(prevAnnouncement);
      
      // Check if we need to load previous page for grid view
      const prevIndex = currentIndex - 1;
      const pageForPrev = Math.floor(prevIndex / itemsPerPage) + 1;
      if (pageForPrev !== currentPage) {
        setCurrentPage(pageForPrev);
      }
    }
  }, [selectedAnnouncement, navigationAnnouncements, currentPage, itemsPerPage]);

  const handleNext = useCallback(() => {
    if (!selectedAnnouncement || navigationAnnouncements.length === 0) return;
    const currentIndex = navigationAnnouncements.findIndex(a => a.id === selectedAnnouncement.id);
    if (currentIndex < navigationAnnouncements.length - 1) {
      const nextAnnouncement = navigationAnnouncements[currentIndex + 1];
      setSelectedAnnouncement(nextAnnouncement);
      
      // Check if we need to load next page for grid view
      const nextIndex = currentIndex + 1;
      const pageForNext = Math.floor(nextIndex / itemsPerPage) + 1;
      if (pageForNext !== currentPage) {
        setCurrentPage(pageForNext);
      }
    }
  }, [selectedAnnouncement, navigationAnnouncements, currentPage, itemsPerPage]);

  const canGoPrevious = useCallback(() => {
    if (!selectedAnnouncement || navigationAnnouncements.length === 0) return false;
    const currentIndex = navigationAnnouncements.findIndex(a => a.id === selectedAnnouncement.id);
    return currentIndex > 0;
  }, [selectedAnnouncement, navigationAnnouncements]);

  const canGoNext = useCallback(() => {
    if (!selectedAnnouncement || navigationAnnouncements.length === 0) return false;
    const currentIndex = navigationAnnouncements.findIndex(a => a.id === selectedAnnouncement.id);
    return currentIndex < navigationAnnouncements.length - 1;
  }, [selectedAnnouncement, navigationAnnouncements]);

  // Reset page when tab or search changes
  useEffect(() => {
    setCurrentPage(1);
    setModalOpen(false);
    setSelectedAnnouncement(null);
  }, [activeTab, searchQuery]);

  // Update navigation list when filters change (if modal is open)
  useEffect(() => {
    if (modalOpen) {
      setNavigationAnnouncements(filteredAnnouncements);
    }
  }, [filteredAnnouncements, modalOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!modalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && canGoPrevious()) {
        e.preventDefault();
        handlePrevious();
      } else if (e.key === 'ArrowRight' && canGoNext()) {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalOpen, canGoPrevious, canGoNext, handlePrevious, handleNext]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcements"
        description="Stay updated with the latest company announcements"
      />

      {/* Header with Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        {/* Search Bar */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search announcements by title, content, or author..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Filter className="w-4 h-4" />
            <span>Filter:</span>
          </div>
          <div className="flex gap-2 flex-1 flex-wrap">
            {(['ALL', 'GENERAL', 'BANK_UPDATES', 'SALES_REPORT'] as const).map((category) => {
              const count = categoryCounts?.[category] ?? 0;
              
              return (
                <button
                  key={category}
                  onClick={() => setActiveTab(category)}
                  className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md font-medium transition-all text-sm ${
                    activeTab === category
                      ? category === 'ALL'
                        ? 'bg-primary-100 text-primary-700 border border-primary-300 shadow-sm'
                        : `${getCategoryColor(category)} shadow-sm`
                      : 'text-gray-600 hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  {category !== 'ALL' && getCategoryIcon(category)}
                  <span>{category === 'ALL' ? 'All' : getCategoryLabel(category)}</span>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${
                    activeTab === category
                      ? 'bg-white/50'
                      : 'bg-gray-200'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Announcements Grid */}
      {loading ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading announcements...</p>
        </div>
      ) : filteredAnnouncements.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Megaphone className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No Announcements Found
          </h3>
          <p className="text-gray-600">
            {searchQuery 
              ? `No announcements match your search "${searchQuery}"`
              : activeTab === 'ALL'
              ? 'There are no active announcements at the moment.'
              : `There are no active ${getCategoryLabel(activeTab).toLowerCase()} announcements at the moment.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="wait">
            {Array.isArray(paginatedAnnouncements) && paginatedAnnouncements.map((announcement, index) => (
              <motion.div
                key={announcement.id}
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
                onClick={() => handleCardClick(announcement)}
                className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col cursor-pointer"
              >
                {/* Image */}
                <div className="relative w-full aspect-video overflow-hidden bg-gray-100">
                  {/* Fallback background */}
                  <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                    <div className={`p-4 rounded-full ${getCategoryColor(announcement.category)}`}>
                      {getCategoryIcon(announcement.category)}
                    </div>
                  </div>
                  {/* Image overlay */}
                  {announcement.image_path && (
                    <img
                      src={`${API_URL.replace('/api', '')}/api/announcements/${announcement.id}/image`}
                      alt={announcement.title}
                      className="relative w-full h-full object-cover hover:scale-105 transition-transform duration-300 z-10"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.opacity = '0';
                      }}
                    />
                  )}
                </div>

                {/* Card Content */}
                <div className="p-5 flex flex-col flex-1">
                  {/* Category Badge */}
                  <div className="mb-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${getCategoryColor(announcement.category)}`}>
                      {getCategoryIcon(announcement.category)}
                      {getCategoryLabel(announcement.category)}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2 min-h-[3.5rem]">
                    {announcement.title}
                  </h3>

                  {/* Content Preview */}
                  <p className="text-sm text-gray-600 line-clamp-3 mb-4 flex-1">
                    {announcement.content}
                  </p>

                  {/* Footer */}
                  <div className="pt-4 border-t border-gray-200 mt-auto">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" />
                        <span className="truncate max-w-[100px]">{announcement.author_name}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{format(new Date(announcement.created_at), 'MMM dd, yyyy')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Pagination */}
      {!loading && filteredAnnouncements.length > itemsPerPage && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-2 mt-6"
        >
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>
          <span className="px-4 py-2 text-sm text-gray-600">
            Page {currentPage} of {totalPages} ({filteredAnnouncements.length} total)
          </span>
          <button
            onClick={() => setCurrentPage(prev => prev + 1)}
            disabled={currentPage >= totalPages}
            className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {/* Announcement Detail Modal */}
      <AnimatePresence>
        {modalOpen && selectedAnnouncement && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 md:p-4"
              onClick={() => setModalOpen(false)}
            >
              {/* Left Arrow - Outside Modal */}
              {canGoPrevious() && (
                <motion.button
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePrevious();
                  }}
                  className="absolute left-2 md:left-4 top-1/2 transform -translate-y-1/2 z-10 p-2 md:p-4 bg-white rounded-full shadow-xl hover:bg-gray-100 transition-all hover:scale-110"
                >
                  <ChevronLeft className="w-5 h-5 md:w-8 md:h-8 text-gray-700" />
                </motion.button>
              )}

              {/* Right Arrow - Outside Modal */}
              {canGoNext() && (
                <motion.button
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNext();
                  }}
                  className="absolute right-2 md:right-4 top-1/2 transform -translate-y-1/2 z-10 p-2 md:p-4 bg-white rounded-full shadow-xl hover:bg-gray-100 transition-all hover:scale-110"
                >
                  <ChevronRight className="w-5 h-5 md:w-8 md:h-8 text-gray-700" />
                </motion.button>
              )}

              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.3 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-lg shadow-xl max-w-6xl w-full overflow-hidden flex flex-col relative"
                style={{ height: '90vh', maxHeight: '90vh', minHeight: '50vh' }}
              >
                {/* Close Button */}
                <button
                  onClick={() => setModalOpen(false)}
                  className="absolute top-2 md:top-4 right-2 md:right-4 z-10 p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors"
                >
                  <X className="w-4 h-4 md:w-5 md:h-5 text-gray-600" />
                </button>

                {/* Position Indicator */}
                {navigationAnnouncements.length > 0 && (
                  <div className="absolute top-2 md:top-4 left-1/2 transform -translate-x-1/2 z-10 px-3 md:px-4 py-1 md:py-1.5 bg-black/70 text-white text-xs md:text-sm rounded-full">
                    {navigationAnnouncements.findIndex(a => a.id === selectedAnnouncement.id) + 1} of {navigationAnnouncements.length}
                  </div>
                )}

                {/* Loading Overlay */}
                {loadingNavigation && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                  </div>
                )}

                {/* Modal Content */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={selectedAnnouncement.id}
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{ duration: 0.4, ease: 'easeInOut' }}
                    className="flex flex-col md:flex-row flex-1 overflow-hidden h-full"
                  >
                    {/* Image Section - Left Side */}
                    {selectedAnnouncement.image_path && (
                      <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2, duration: 0.4 }}
                        className="w-full md:w-1/2 flex-shrink-0 bg-gray-100 overflow-auto flex items-center justify-center p-4 md:p-6 min-h-[200px] md:min-h-0"
                      >
                        <img
                          src={`${API_URL.replace('/api', '')}/api/announcements/${selectedAnnouncement.id}/image`}
                          alt={selectedAnnouncement.title}
                          className="max-w-full max-h-full w-auto h-auto object-contain"
                          style={{ maxHeight: 'calc(90vh - 2rem)' }}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                      </motion.div>
                    )}

                    {/* Content Section - Right Side */}
                    <div className={`flex-1 overflow-y-auto ${selectedAnnouncement.image_path ? 'w-full md:w-1/2' : 'w-full'}`}>
                      <div className="p-4 md:p-8 h-full flex flex-col">
                        {/* Header */}
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 }}
                          className="flex items-center gap-3 mb-4"
                        >
                          <div className={`p-2 rounded-lg ${getCategoryColor(selectedAnnouncement.category)}`}>
                            {getCategoryIcon(selectedAnnouncement.category)}
                          </div>
                          <span className={`px-3 py-1 text-xs font-medium rounded-full ${getCategoryColor(selectedAnnouncement.category)}`}>
                            {getCategoryLabel(selectedAnnouncement.category)}
                          </span>
                        </motion.div>

                        {/* Title */}
                        <motion.h2 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.15 }}
                          className="text-xl md:text-3xl font-bold text-gray-900 mb-4 md:mb-6"
                        >
                          {selectedAnnouncement.title}
                        </motion.h2>

                        {/* Content */}
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2 }}
                          className="prose max-w-none mb-6 flex-1"
                        >
                          <p className="text-gray-700 leading-relaxed whitespace-pre-wrap text-base">
                            {selectedAnnouncement.content}
                          </p>
                        </motion.div>

                        {/* Footer */}
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.25 }}
                          className="flex items-center gap-6 pt-6 border-t border-gray-200 mt-auto"
                        >
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <User className="w-4 h-4" />
                            <span>{selectedAnnouncement.author_name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="w-4 h-4" />
                            <span>{format(new Date(selectedAnnouncement.created_at), 'MMMM dd, yyyy')}</span>
                          </div>
                        </motion.div>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

