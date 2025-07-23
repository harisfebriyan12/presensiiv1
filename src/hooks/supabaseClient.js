import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if we're in development mode with placeholder values
const isPlaceholderUrl = !supabaseUrl || 
  supabaseUrl === 'your_supabase_url_here' || 
  !supabaseUrl.startsWith('http') ||
  supabaseUrl.includes('placeholder') ||
  supabaseUrl.length < 10;

const isPlaceholderKey = !supabaseAnonKey || 
  supabaseAnonKey === 'your_supabase_anon_key_here' ||
  supabaseAnonKey.includes('placeholder') ||
  supabaseAnonKey.length < 10;

let supabase;

if (isPlaceholderUrl || isPlaceholderKey) {
  console.warn(
    '⚠️ Supabase not configured - using development mode.\n' +
    'To connect to Supabase:\n' +
    '1. Click "Connect to Supabase" button in the top right\n' +
    '2. Or manually update your .env file with actual Supabase credentials\n' +
    `Current URL: ${supabaseUrl || 'undefined'}\n` +
    `Current Key: ${supabaseAnonKey ? '[REDACTED]' : 'undefined'}`
  );
  
  // Create a comprehensive mock client for development
  const createMockResponse = (message = 'Supabase not configured') => ({
    data: null,
    error: { message, code: 'SUPABASE_NOT_CONFIGURED' }
  });

  const createMockSuccessResponse = (data = null) => ({
    data,
    error: null
  });

  supabase = {
    auth: {
      signUp: () => Promise.resolve(createMockResponse('Please configure Supabase to sign up')),
      signInWithPassword: () => Promise.resolve(createMockResponse('Please configure Supabase to sign in')),
      signOut: () => Promise.resolve({ error: null }),
      getSession: () => Promise.resolve(createMockSuccessResponse({ session: null })),
      getUser: () => Promise.resolve(createMockSuccessResponse({ user: null })),
      onAuthStateChange: (callback) => {
        // Call callback immediately with no session
        if (callback) {
          setTimeout(() => callback('SIGNED_OUT', null), 0);
        }
        return { 
          data: { 
            subscription: { 
              unsubscribe: () => {} 
            } 
          } 
        };
      },
      updateUser: () => Promise.resolve(createMockResponse('Please configure Supabase to update user')),
      resetPasswordForEmail: () => Promise.resolve(createMockResponse('Please configure Supabase for password reset'))
    },
    from: (table) => ({
      select: (columns = '*') => ({
        eq: (column, value) => ({
          single: () => Promise.resolve(createMockResponse(`Please configure Supabase to query ${table}`)),
          maybeSingle: () => Promise.resolve(createMockResponse(`Please configure Supabase to query ${table}`)),
          limit: (count) => Promise.resolve(createMockResponse(`Please configure Supabase to query ${table}`)),
          order: (column, options) => Promise.resolve(createMockResponse(`Please configure Supabase to query ${table}`))
        }),
        neq: (column, value) => ({
          limit: (count) => Promise.resolve(createMockResponse(`Please configure Supabase to query ${table}`)),
          order: (column, options) => Promise.resolve(createMockResponse(`Please configure Supabase to query ${table}`))
        }),
        order: (column, options) => ({
          limit: (count) => Promise.resolve(createMockResponse(`Please configure Supabase to query ${table}`))
        }),
        limit: (count) => Promise.resolve(createMockResponse(`Please configure Supabase to query ${table}`)),
        range: (from, to) => Promise.resolve(createMockResponse(`Please configure Supabase to query ${table}`))
      }),
      insert: (data) => ({
        select: () => Promise.resolve(createMockResponse(`Please configure Supabase to insert into ${table}`))
      }),
      update: (data) => ({
        eq: (column, value) => ({
          select: () => Promise.resolve(createMockResponse(`Please configure Supabase to update ${table}`))
        })
      }),
      delete: () => ({
        eq: (column, value) => Promise.resolve(createMockResponse(`Please configure Supabase to delete from ${table}`))
      }),
      upsert: (data) => ({
        select: () => Promise.resolve(createMockResponse(`Please configure Supabase to upsert into ${table}`))
      })
    }),
    storage: {
      from: (bucket) => ({
        upload: (path, file, options) => Promise.resolve(createMockResponse('Please configure Supabase for file upload')),
        getPublicUrl: (path) => ({ 
          data: { 
            publicUrl: '' 
          } 
        }),
        remove: (paths) => Promise.resolve(createMockResponse('Please configure Supabase for file removal'))
      })
    },
    rpc: (functionName, params) => Promise.resolve(createMockResponse(`Please configure Supabase to call function ${functionName}`))
  };
} else {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce'
      },
      global: {
        headers: {
          'X-Client-Info': 'attendance-app'
        }
      }
    });

    // Clear any invalid sessions on initialization
    const clearInvalidSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('Session error detected, clearing session:', error.message);
          await supabase.auth.signOut();
          // Clear local storage items related to supabase
          localStorage.removeItem(`sb-${supabaseUrl.split('//')[1].split('.')[0]}-auth-token`);
          return;
        }

        if (session) {
          // Verify the session is valid by trying to get user
          const { error: userError } = await supabase.auth.getUser();
          if (userError && (userError.message.includes('user_not_found') || userError.message.includes('JWT'))) {
            console.warn('Invalid user session detected, clearing session:', userError.message);
            await supabase.auth.signOut();
            // Clear local storage items related to supabase
            localStorage.removeItem(`sb-${supabaseUrl.split('//')[1].split('.')[0]}-auth-token`);
          }
        }
      } catch (error) {
        console.warn('Error during session validation, clearing session:', error.message);
        try {
          await supabase.auth.signOut();
          // Clear local storage items related to supabase
          localStorage.removeItem(`sb-${supabaseUrl.split('//')[1].split('.')[0]}-auth-token`);
        } catch (signOutError) {
          console.warn('Error during sign out:', signOutError.message);
        }
      }
    };

    // Run session validation
    clearInvalidSession();

    console.log('✅ Supabase client initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Supabase client:', error);
    // Fall back to mock client if initialization fails
    supabase = {
      auth: {
        signUp: () => Promise.resolve({ data: null, error: { message: 'Supabase initialization failed' } }),
        signInWithPassword: () => Promise.resolve({ data: null, error: { message: 'Supabase initialization failed' } }),
        signOut: () => Promise.resolve({ error: null }),
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        getUser: () => Promise.resolve({ data: { user: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
      },
      from: () => ({
        select: () => ({ 
          eq: () => ({ 
            single: () => Promise.resolve({ data: null, error: { message: 'Supabase initialization failed' } }),
            maybeSingle: () => Promise.resolve({ data: null, error: { message: 'Supabase initialization failed' } }),
            limit: () => Promise.resolve({ data: [], error: { message: 'Supabase initialization failed' } })
          }),
          order: () => Promise.resolve({ data: [], error: { message: 'Supabase initialization failed' } }),
          limit: () => Promise.resolve({ data: [], error: { message: 'Supabase initialization failed' } })
        }),
        insert: () => Promise.resolve({ data: null, error: { message: 'Supabase initialization failed' } }),
        update: () => ({ 
          eq: () => Promise.resolve({ data: null, error: { message: 'Supabase initialization failed' } })
        }),
        delete: () => ({ 
          eq: () => Promise.resolve({ data: null, error: { message: 'Supabase initialization failed' } })
        }),
        upsert: () => Promise.resolve({ data: null, error: { message: 'Supabase initialization failed' } })
      }),
      storage: {
        from: () => ({
          upload: () => Promise.resolve({ data: null, error: { message: 'Supabase initialization failed' } }),
          getPublicUrl: () => ({ data: { publicUrl: '' } })
        })
      }
    };
  }
}

export { supabase };

// Enhanced auth helper with better error handling
export const handleAuthError = async (error) => {
  if (error && (
    error.message?.includes('user_not_found') || 
    error.message?.includes('JWT') ||
    error.message?.includes('Invalid token') ||
    error.code === 'user_not_found'
  )) {
    console.warn('Auth error detected, clearing session:', error.message);
    try {
      await supabase.auth.signOut();
      // Clear local storage
      const urlParts = supabaseUrl.split('//')[1]?.split('.');
      if (urlParts && urlParts[0]) {
        localStorage.removeItem(`sb-${urlParts[0]}-auth-token`);
      }
      // Redirect to login
      window.location.href = '/login';
    } catch (signOutError) {
      console.warn('Error during sign out:', signOutError.message);
      // Force redirect even if sign out fails
      window.location.href = '/login';
    }
  }
};

// Function to get office location from system settings
export const getOfficeLocation = async () => {
  try {
    if (isPlaceholderUrl || isPlaceholderKey) {
      // Return default location when Supabase is not configured
      return {
        latitude: -6.200000,
        longitude: 106.816666,
        radius: 100,
        address: 'Jakarta Office (Demo)'
      };
    }

    const { data, error } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'office_location')
      .eq('is_enabled', true)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      await handleAuthError(error);
      throw error;
    }
    
    return data?.setting_value || {
      latitude: -6.200000,
      longitude: 106.816666,
      radius: 100,
      address: 'Jakarta Office'
    };
  } catch (error) {
    console.error('Error fetching office location:', error);
    await handleAuthError(error);
    // Return default location if fetch fails
    return {
      latitude: -6.200000,
      longitude: 106.816666,
      radius: 100,
      address: 'Jakarta Office'
    };
  }
};

// Function to get camera verification settings
let cachedSettings = null;
let cacheTime = 0;

export const getCameraVerificationSettings = async (forceRefresh = false) => {
  // Use a simple in-memory cache to avoid excessive requests
  
  // Cache for 2 minutes unless force refresh
  const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes
  const now = Date.now();
  
  if (!forceRefresh && cachedSettings && (now - cacheTime < CACHE_DURATION)) {
    return cachedSettings;
  }
  
  try {
    if (isPlaceholderUrl || isPlaceholderKey) {
      // Return default settings when Supabase is not configured
      cachedSettings = {
        enabled: true,
        required_for_admin: false
      };
      cacheTime = now;
      return cachedSettings;
    }

    const { data, error } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'camera_verification')
      .eq('is_enabled', true)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      await handleAuthError(error);
      throw error;
    }

    cachedSettings = data?.setting_value || {
      enabled: true,
      required_for_admin: false
    };
    cacheTime = now;
    return cachedSettings;
  } catch (error) {
    console.error('Error fetching camera verification settings:', error);
    await handleAuthError(error);
    
    // Return default settings if fetch fails
    return {
      enabled: true,
      required_for_admin: false
    };
  }
};

// Default office location (fallback)
export const OFFICE_LOCATION = {
  latitude: -6.200000,
  longitude: 106.816666,
  radius: 100
};

// Upload file to Supabase Storage with better error handling
export const uploadFile = async (file, bucket, fileName) => {
  try {
    if (isPlaceholderUrl || isPlaceholderKey) {
      throw new Error('Supabase not configured - please connect to Supabase first');
    }

    console.log('Uploading file:', fileName, 'to bucket:', bucket);

    // First, try to delete existing file if it exists
    try {
      await supabase.storage
        .from(bucket)
        .remove([fileName]);
    } catch (deleteError) {
      // Ignore delete errors - file might not exist
      console.log('File delete attempt (ignore if not exists):', deleteError.message);
    }

    // Upload the file with upsert option
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true // Allow overwriting existing files
      });

    if (error) {
      console.error('Upload error details:', error);
      await handleAuthError(error);
      throw new Error(`Upload failed: ${error.message}`);
    }

    console.log('Upload successful:', data);
    return data;
  } catch (error) {
    console.error('Upload error:', error);
    await handleAuthError(error);
    throw error;
  }
};

// Get file URL from Supabase Storage
export const getFileUrl = (bucket, fileName) => {
  if (isPlaceholderUrl || isPlaceholderKey) {
    return '';
  }

  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(fileName);
  
  return data.publicUrl;
};

// Helper function to check if Supabase is properly configured
export const isSupabaseConfigured = () => {
  return !isPlaceholderUrl && !isPlaceholderKey;
};

// Enhanced session management
export const refreshSession = async () => {
  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      await handleAuthError(error);
      throw error;
    }
    return data;
  } catch (error) {
    console.error('Session refresh failed:', error);
    await handleAuthError(error);
    throw error;
  }
};

// Safe user getter with error handling
export const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      await handleAuthError(error);
      return null;
    }
    return user;
  } catch (error) {
    console.error('Get user failed:', error);
    await handleAuthError(error);
    return null;
  }
};