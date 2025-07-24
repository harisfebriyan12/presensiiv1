import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export const useAuth = () => {
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSessionAndRole = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Session error:', error);
          await supabase.auth.signOut();
          setSession(null);
        } else {
          setSession(session);
          if (session) {
            await fetchUserRole(session.user.id);
          }
        }
      } catch (error) {
        console.error('Unexpected session error:', error);
        await supabase.auth.signOut();
        setSession(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSessionAndRole();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) {
        await fetchUserRole(session.user.id);
      } else {
        setUserRole(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRole = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      if (error) throw error;
      setUserRole(data.role);
    } catch (error) {
      console.error('Error fetching user role:', error);
      setUserRole(null);
    }
  };

  return { session, userRole, loading };
};
