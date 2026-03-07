export const environment = {
  production: false,
  supabase: {
    url: 'https://hpfsnuwydifiynzpheql.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwZnNudXd5ZGlmaXluenBoZXFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2Nzc2OTIsImV4cCI6MjA4NzI1MzY5Mn0.E832J6Vz-jm4_1qOJF9r1q0OZZMhbSB_FUyHtzr_1Lk',
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
