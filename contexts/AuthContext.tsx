
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, SystemConfig } from '../types';
import { supabase } from '../lib/supabaseClient';
import { dbService } from '../services/dbService';

interface AuthContextType {
  user: User | null;
  systemConfig: SystemConfig;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  getAllUsers: () => Promise<User[]>;
  toggleUserStatus: (userId: string) => Promise<void>;
  updateSystemConfig: (config: SystemConfig) => Promise<void>;
  changePassword: (password: string) => Promise<void>;
}

const DEFAULT_CONFIG: SystemConfig = {
  allowSignups: true,
  landingPage: {
    heroTitle: "Financial Clarity.\nFor the Elite.",
    heroSubtitle: "CreditTrack by EliteX.CC: The AI-powered bill tracker designed for Singapore's top tier.",
    bullets: ["Auto-extract data", "Miles Optimization Strategy", "Consolidated Wealth View"]
  }
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth event:", event, session);
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        if (session?.user) {
          setUser({
              id: session.user.id,
              email: session.user.email!,
              name: session.user.user_metadata?.name || session.user.email!.split('@')[0],
              role: 'user',
              joinedAt: session.user.created_at,
              status: 'active'
          });
          // Fetch full profile in background
          fetchProfile(session.user.id, session.user.email!);
        } else {
          setUser(null);
        }
        setLoading(false); // Unblock UI immediately
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setLoading(false);
      } else if (event === 'PASSWORD_RECOVERY') {
        console.log("Password recovery mode triggered");
        setLoading(false);
      }
    });

    // Also run init for system config
    const init = async () => {
      try {
        dbService.getSystemConfig().then(config => {
            if (config) setSystemConfig(config);
        }).catch(err => console.error("System config fetch failed:", err));
        
        // Fallback: if onAuthStateChange doesn't fire INITIAL_SESSION quickly enough
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(prev => prev || {
            id: session.user.id,
            email: session.user.email!,
            name: session.user.user_metadata?.name || session.user.email!.split('@')[0],
            role: 'user',
            joinedAt: session.user.created_at,
            status: 'active'
          });
        }
      } catch (err) {
        console.error("Auth init failed:", err);
      }
    };

    init();

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (uid: string, email: string) => {
    try {
        let { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .single();

        if (!data) {
            const { data: newProfile } = await supabase
                .from('profiles')
                .insert({
                    id: uid,
                    email: email,
                    name: email.split('@')[0],
                    role: 'user',
                    status: 'active'
                })
                .select()
                .single();
            data = newProfile;
        }

        if (data) {
            setUser({
                id: data.id,
                email: data.email,
                name: data.name,
                role: data.role as 'admin' | 'user',
                joinedAt: data.created_at,
                status: data.status as 'active' | 'suspended'
            });
        }
    } catch (err) {
        console.error("Profile fetch failed:", err);
    }
  };

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signup = async (name: string, email: string, password: string) => {
    if (!systemConfig.allowSignups && email !== 'jeratomise@gmail.com') {
        throw new Error("Registrations are currently disabled.");
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } }
    });
    if (error) throw error;
    if (data.user) {
        await supabase.from('profiles').insert({
            id: data.user.id,
            email: email,
            name: name,
            role: email === 'jeratomise@gmail.com' ? 'admin' : 'user'
        });
    }
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) throw error;
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const getAllUsers = async (): Promise<User[]> => {
      const { data, error } = await supabase.from('profiles').select('*');
      if (error) throw error;
      return data.map((u: any) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          status: u.status,
          joinedAt: u.created_at
      }));
  };

  const toggleUserStatus = async (userId: string) => {
      const { data } = await supabase.from('profiles').select('status').eq('id', userId).single();
      const newStatus = data?.status === 'active' ? 'suspended' : 'active';
      const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', userId);
      if (error) throw error;
  };

  const updateSystemConfig = async (config: SystemConfig) => {
      await dbService.updateSystemConfig(config);
      setSystemConfig(config);
  };

  const changePassword = async (password: string) => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ 
        user, 
        systemConfig,
        login, 
        signup, 
        resetPassword,
        logout, 
        loading,
        getAllUsers,
        toggleUserStatus,
        updateSystemConfig,
        changePassword
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
