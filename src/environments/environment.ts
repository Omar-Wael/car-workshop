export const environment = {
  production: false,
  supabase: {
    url: 'YOUR_SUPABASE_URL',
    key: 'YOUR_SUPABASE_ANON_KEY',
  },
  maxFileSize: 1.5 * 1024 * 1024,
  cacheDuration: 5 * 60 * 1000,
  defaultDepartments: [
    'إدارة النقل',
    'الإدارة الهندسية',
    'إدارة الصيانة',
    'الإدارة الإدارية',
    'إدارة المشتريات',
    'إدارة الخدمات',
    'إدارة المخازن',
    'إدارة العمليات',
    'إدارة الأمن',
    'الإدارة المالية',
  ],
};

export const environment_prod = {
  ...environment,
  production: true,
};
