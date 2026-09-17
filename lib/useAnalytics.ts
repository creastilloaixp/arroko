/**
 * Advanced Analytics Hook
 * Provides comprehensive analytics data from Supabase
 */

import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export interface UserMetrics {
  totalParticipants: number;
  totalSpins: number;
  totalRedemptions: number;
  conversionRate: number;
  avgSessionDuration: number;
  bounceRate: number;
}

export interface UserJourney {
  participant_id: string;
  full_name: string;
  email: string;
  phone: string;
  created_at: string;
  events: Array<{
    event_type: string;
    created_at: string;
    metadata: any;
  }>;
  spin?: {
    prize_name: string;
    redeemed: boolean;
    created_at: string;
  };
}

export interface TopPrize {
  prize_id: string;
  prize_name: string;
  count: number;
  redemption_rate: number;
}

export interface TimeSeriesData {
  date: string;
  participants: number;
  spins: number;
  redemptions: number;
}

export interface ConversionFunnel {
  stage: string;
  count: number;
  percentage: number;
  drop_off: number;
}

export const useAnalytics = () => {
  const [metrics, setMetrics] = useState<UserMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch overall metrics
  const fetchMetrics = async (): Promise<UserMetrics | null> => {
    try {
      const { data: participants, error: participantsError } = await supabase!
        .from('participants')
        .select('id');

      const { data: spins, error: spinsError } = await supabase!
        .from('spins')
        .select('id, redeemed');

      if (participantsError || spinsError) {
        throw new Error('Error fetching metrics');
      }

      const totalParticipants = participants?.length || 0;
      const totalSpins = spins?.length || 0;
      const totalRedemptions = spins?.filter(s => s.redeemed).length || 0;

      const conversionRate = totalSpins > 0 ? (totalRedemptions / totalSpins) * 100 : 0;

      return {
        totalParticipants,
        totalSpins,
        totalRedemptions,
        conversionRate,
        avgSessionDuration: 0, // Will calculate from interactions
        bounceRate: 0, // Will calculate from interactions
      };
    } catch (err) {
      console.error('Error fetching metrics:', err);
      return null;
    }
  };

  // Get user journeys with detailed tracking
  const getUserJourneys = async (limit: number = 50): Promise<UserJourney[]> => {
    try {
      const { data: participants, error: participantsError } = await supabase!
        .from('participants')
        .select(`
          id,
          full_name,
          email,
          phone,
          created_at
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (participantsError || !participants) {
        throw participantsError;
      }

      // Get interactions for each participant
      const journeys: UserJourney[] = await Promise.all(
        participants.map(async (p) => {
          const { data: interactions } = await supabase!
            .from('user_interactions')
            .select('event_type, created_at, metadata')
            .eq('participant_id', p.id)
            .order('created_at', { ascending: true });

          const { data: spin } = await supabase!
            .from('spins')
            .select('prize_id, redeemed, created_at')
            .eq('participant_id', p.id)
            .single();

          return {
            participant_id: p.id,
            full_name: p.full_name,
            email: p.email,
            phone: p.phone,
            created_at: p.created_at,
            events: interactions || [],
            spin: spin ? {
              prize_name: spin.prize_id,
              redeemed: spin.redeemed,
              created_at: spin.created_at
            } : undefined,
          };
        })
      );

      return journeys;
    } catch (err) {
      console.error('Error fetching user journeys:', err);
      return [];
    }
  };

  // Get top prizes statistics
  const getTopPrizes = async (): Promise<TopPrize[]> => {
    try {
      const { data: spins, error } = await supabase!
        .from('spins')
        .select('prize_id, redeemed');

      if (error || !spins) {
        throw error;
      }

      // Group by prize_id
      const prizeMap = new Map<string, { count: number; redeemed: number }>();

      spins.forEach(spin => {
        const current = prizeMap.get(spin.prize_id) || { count: 0, redeemed: 0 };
        current.count++;
        if (spin.redeemed) current.redeemed++;
        prizeMap.set(spin.prize_id, current);
      });

      // Convert to array and calculate redemption rate
      const topPrizes: TopPrize[] = Array.from(prizeMap.entries()).map(([prize_id, data]) => ({
        prize_id,
        prize_name: prize_id, // You can map this to actual prize names
        count: data.count,
        redemption_rate: (data.redeemed / data.count) * 100,
      }));

      // Sort by count
      topPrizes.sort((a, b) => b.count - a.count);

      return topPrizes;
    } catch (err) {
      console.error('Error fetching top prizes:', err);
      return [];
    }
  };

  // Get time series data for charts
  const getTimeSeriesData = async (days: number = 30): Promise<TimeSeriesData[]> => {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data: participants } = await supabase!
        .from('participants')
        .select('created_at')
        .gte('created_at', startDate.toISOString());

      const { data: spins } = await supabase!
        .from('spins')
        .select('created_at, redeemed')
        .gte('created_at', startDate.toISOString());

      // Group by date
      const dateMap = new Map<string, { participants: number; spins: number; redemptions: number }>();

      participants?.forEach(p => {
        const date = new Date(p.created_at).toISOString().split('T')[0];
        const current = dateMap.get(date) || { participants: 0, spins: 0, redemptions: 0 };
        current.participants++;
        dateMap.set(date, current);
      });

      spins?.forEach(s => {
        const date = new Date(s.created_at).toISOString().split('T')[0];
        const current = dateMap.get(date) || { participants: 0, spins: 0, redemptions: 0 };
        current.spins++;
        if (s.redeemed) current.redemptions++;
        dateMap.set(date, current);
      });

      // Convert to array and sort
      const timeSeriesData: TimeSeriesData[] = Array.from(dateMap.entries())
        .map(([date, data]) => ({
          date,
          ...data,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return timeSeriesData;
    } catch (err) {
      console.error('Error fetching time series data:', err);
      return [];
    }
  };

  // Get conversion funnel
  const getConversionFunnel = async (): Promise<ConversionFunnel[]> => {
    try {
      const metrics = await fetchMetrics();
      if (!metrics) return [];

      const { data: interactions } = await supabase!
        .from('user_interactions')
        .select('event_type, participant_id');

      const uniqueVisitors = new Set(interactions?.map(i => i.participant_id) || []).size;
      const registrations = metrics.totalParticipants;
      const spins = metrics.totalSpins;
      const redemptions = metrics.totalRedemptions;

      const funnel: ConversionFunnel[] = [
        {
          stage: 'Visitantes',
          count: uniqueVisitors,
          percentage: 100,
          drop_off: 0,
        },
        {
          stage: 'Registros',
          count: registrations,
          percentage: (registrations / uniqueVisitors) * 100,
          drop_off: uniqueVisitors - registrations,
        },
        {
          stage: 'Participaciones',
          count: spins,
          percentage: (spins / registrations) * 100,
          drop_off: registrations - spins,
        },
        {
          stage: 'Canjes',
          count: redemptions,
          percentage: (redemptions / spins) * 100,
          drop_off: spins - redemptions,
        },
      ];

      return funnel;
    } catch (err) {
      console.error('Error calculating conversion funnel:', err);
      return [];
    }
  };

  // Search participants by criteria
  const searchParticipants = async (query: string): Promise<UserJourney[]> => {
    try {
      const { data: participants } = await supabase!
        .from('participants')
        .select('*')
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
        .limit(20);

      if (!participants) return [];

      // Get full journey for each
      const journeys = await Promise.all(
        participants.map(async (p) => {
          const { data: interactions } = await supabase!
            .from('user_interactions')
            .select('*')
            .eq('participant_id', p.id);

          const { data: spin } = await supabase!
            .from('spins')
            .select('*')
            .eq('participant_id', p.id)
            .single();

          return {
            participant_id: p.id,
            full_name: p.full_name,
            email: p.email,
            phone: p.phone,
            created_at: p.created_at,
            events: interactions || [],
            spin: spin ? {
              prize_name: spin.prize_id,
              redeemed: spin.redeemed,
              created_at: spin.created_at,
            } : undefined,
          };
        })
      );

      return journeys;
    } catch (err) {
      console.error('Error searching participants:', err);
      return [];
    }
  };

  // Initialize
  useEffect(() => {
    const loadMetrics = async () => {
      setIsLoading(true);
      const data = await fetchMetrics();
      setMetrics(data);
      setIsLoading(false);
    };

    loadMetrics();
  }, []);

  return {
    metrics,
    isLoading,
    error,
    fetchMetrics,
    getUserJourneys,
    getTopPrizes,
    getTimeSeriesData,
    getConversionFunnel,
    searchParticipants,
  };
};
