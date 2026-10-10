import { useState, useEffect } from 'react'
import { MessagingDashboard } from './features/messaging/components/MessagingDashboard'
import { HomeDashboard } from './features/dashboard/components/HomeDashboard'
import { AllServices } from './features/services/components/AllServices'
import { ECRDashboard } from './features/ecr/components/ECRDashboard'
import { ECSDashboard } from './features/ecs/components/ECSDashboard'
import { DesignSystemShowcase } from './features/dashboard/components/DesignSystemShowcase'
import { ThemeSelector } from './components/ThemeSelector'
import { 
  LayoutDashboard, 
  Server, 
  Database, 
  DatabaseZap, 
  Zap, 
  Globe, 
  Activity, 
  ScrollText, 
  ShieldCheck, 
  Settings, 
  MessageSquare, 
  Network, 
  Lock, 
  Box, 
  FileCode, 
  Layers,
  Radio,
  TableProperties,
  Key,
  FileCheck,
  BarChart3,
  Settings2,
  Waves,
  Mail,
  RefreshCw,
  FlaskConical,
  SearchCode,
  Truck,
  HardDrive,
  Folder,
  Scale,
  Cloud,
  Package,
  Hammer,
  Map,
  FolderOpen,
  Building,
  UserSquare,
  Clock,
  Save,
  MousePointer2,
  Search,
  ChevronDown,
  Bell,
  Monitor,
  Menu,
  Cpu,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

type ServiceId = string;

interface Resource {
  id: ServiceId;
  name: string;
  icon: string;
  implemented: boolean;
  category: string;
}

function App() {
  const [activeTab, setActiveTab] = useState<ServiceId>('home');
  const [history, setHistory] = useState<string[]>(['home']);
  const [historyPointer, setHistoryPointer] = useState<number>(0);
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('themeMode') as 'light' | 'dark' || 'dark';
    }
    return 'dark';
  });

  const [themeColor, setThemeColor] = useState<'blue' | 'emerald' | 'violet' | 'rose' | 'amber'>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('themeColor') as 'blue' | 'emerald' | 'violet' | 'rose' | 'amber' || 'blue';
    }
    return 'blue';
  });

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [openCategories, setOpenCategories] = useState<string[]>([]);

  const toggleCategory = (category: string) => {
    setOpenCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category) 
        : [...prev, category]
    );
  };

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark', 'theme-blue', 'theme-emerald', 'theme-violet', 'theme-rose', 'theme-amber');
    root.classList.add(themeMode);
    root.classList.add(`theme-${themeColor}`);
    localStorage.setItem('themeMode', themeMode);
    localStorage.setItem('themeColor', themeColor);
  }, [themeMode, themeColor]);

  const resources: Resource[] = [
    { id: 'home', name: 'Dashboard', icon: 'LayoutDashboard', implemented: true, category: 'GENERAL' },
    { id: 'services', name: 'All Services', icon: 'Layers', implemented: true, category: 'GENERAL' },
    { id: 'design-system', name: 'Design System', icon: 'FileCode', implemented: true, category: 'GENERAL' },
    
    // Compute
    { id: 'lambda', name: 'Lambda', icon: 'Zap', implemented: false, category: 'COMPUTE' },
    { id: 'ecs', name: 'ECS', icon: 'Box', implemented: true, category: 'COMPUTE' },
    { id: 'ec2', name: 'EC2', icon: 'Monitor', implemented: false, category: 'COMPUTE' },
    { id: 'autoscaling', name: 'AutoScaling', icon: 'Activity', implemented: false, category: 'COMPUTE' },
    { id: 'batch', name: 'Batch', icon: 'Settings', implemented: false, category: 'COMPUTE' },
    { id: 'imds', name: 'IMDS', icon: 'Radio', implemented: false, category: 'COMPUTE' },
    { id: 'eks', name: 'EKS', icon: 'Box', implemented: false, category: 'COMPUTE' },

    // Storage
    { id: 's3', name: 'S3', icon: 'DatabaseZap', implemented: false, category: 'STORAGE' },
    { id: 'ebs', name: 'EBS', icon: 'HardDrive', implemented: false, category: 'STORAGE' },
    { id: 'efs', name: 'EFS', icon: 'Folder', implemented: false, category: 'STORAGE' },
    { id: 'ecr', name: 'ECR', icon: 'Package', implemented: true, category: 'STORAGE' },
    { id: 's3files', name: 'S3 Files', icon: 'FolderOpen', implemented: false, category: 'STORAGE' },

    // Database
    { id: 'dynamodb', name: 'DynamoDB', icon: 'TableProperties', implemented: false, category: 'DATABASE' },
    { id: 'rds', name: 'RDS', icon: 'Database', implemented: false, category: 'DATABASE' },
    { id: 'elasticache', name: 'ElastiCache', icon: 'DatabaseZap', implemented: false, category: 'DATABASE' },
    { id: 'rdsdata', name: 'RDS Data API', icon: 'Database', implemented: false, category: 'DATABASE' },

    // Messaging
    { id: 'messaging', name: 'SQS', icon: 'MessageSquare', implemented: true, category: 'MESSAGING' },
    { id: 'sns', name: 'SNS', icon: 'Radio', implemented: true, category: 'MESSAGING' },
    
    // Integration
    { id: 'eventbridge', name: 'EventBridge', icon: 'Network', implemented: false, category: 'INTEGRATION' },
    { id: 'ses', name: 'SES', icon: 'Mail', implemented: false, category: 'INTEGRATION' },
    { id: 'stepfunctions', name: 'Step Functions', icon: 'RefreshCw', implemented: false, category: 'INTEGRATION' },
    { id: 'sesv2', name: 'SES v2', icon: 'Mail', implemented: false, category: 'INTEGRATION' },
    { id: 'ebscheduler', name: 'EB Scheduler', icon: 'Clock', implemented: false, category: 'INTEGRATION' },
    { id: 'transfer', name: 'Transfer', icon: 'MousePointer2', implemented: false, category: 'INTEGRATION' },

    // Networking
    { id: 'apigwv2', name: 'API Gateway v2', icon: 'Globe', implemented: false, category: 'NETWORKING' },
    { id: 'apigwv1', name: 'API Gateway v1', icon: 'Globe', implemented: false, category: 'NETWORKING' },
    { id: 'route53', name: 'Route53', icon: 'Globe', implemented: false, category: 'NETWORKING' },
    { id: 'alb', name: 'ALB / ELBv2', icon: 'Scale', implemented: false, category: 'NETWORKING' },
    { id: 'appsync', name: 'AppSync', icon: 'Zap', implemented: false, category: 'NETWORKING' },
    { id: 'cloudfront', name: 'CloudFront', icon: 'Globe', implemented: false, category: 'NETWORKING' },
    { id: 'cloudmap', name: 'Cloud Map', icon: 'Map', implemented: false, category: 'NETWORKING' },

    // Security
    { id: 'iam', name: 'IAM', icon: 'ShieldCheck', implemented: false, category: 'SECURITY' },
    { id: 'sts', name: 'STS', icon: 'FileCheck', implemented: false, category: 'SECURITY' },
    { id: 'secrets', name: 'Secrets Manager', icon: 'Key', implemented: false, category: 'SECURITY' },
    { id: 'cognito', name: 'Cognito', icon: 'Lock', implemented: false, category: 'SECURITY' },
    { id: 'acm', name: 'ACM', icon: 'ShieldCheck', implemented: false, category: 'SECURITY' },
    { id: 'wafv2', name: 'WAF v2', icon: 'ShieldCheck', implemented: false, category: 'SECURITY' },
    { id: 'kms', name: 'KMS', icon: 'Key', implemented: false, category: 'SECURITY' },
    { id: 'wafclassic', name: 'WAF Classic', icon: 'ShieldCheck', implemented: false, category: 'SECURITY' },

    // Analytics
    { id: 'kinesis', name: 'Kinesis', icon: 'Waves', implemented: false, category: 'ANALYTICS' },
    { id: 'glue', name: 'Glue', icon: 'FlaskConical', implemented: false, category: 'ANALYTICS' },
    { id: 'athena', name: 'Athena', icon: 'SearchCode', implemented: false, category: 'ANALYTICS' },
    { id: 'firehose', name: 'Firehose', icon: 'Truck', implemented: false, category: 'ANALYTICS' },
    { id: 'emr', name: 'EMR', icon: 'Zap', implemented: false, category: 'ANALYTICS' },
    { id: 'opensearch', name: 'OpenSearch', icon: 'Search', implemented: false, category: 'ANALYTICS' },

    // Management
    { id: 'ssm', name: 'SSM Params', icon: 'Settings2', implemented: false, category: 'MANAGEMENT' },
    { id: 'cloudformation', name: 'CloudFormation', icon: 'Cloud', implemented: false, category: 'MANAGEMENT' },
    { id: 'codebuild', name: 'CodeBuild', icon: 'Hammer', implemented: false, category: 'MANAGEMENT' },
    { id: 'organizations', name: 'Organizations', icon: 'Building', implemented: false, category: 'MANAGEMENT' },
    { id: 'account', name: 'Account', icon: 'UserSquare', implemented: false, category: 'MANAGEMENT' },
    { id: 'backup', name: 'Backup', icon: 'Save', implemented: false, category: 'MANAGEMENT' },
    { id: 'appconfig', name: 'AppConfig', icon: 'Settings', implemented: false, category: 'MANAGEMENT' },
    { id: 'tagging', name: 'Resource Tagging', icon: 'Settings', implemented: false, category: 'MANAGEMENT' },
    
    // Monitoring
    { id: 'cwlogs', name: 'CW Logs', icon: 'BarChart3', implemented: false, category: 'MONITORING' },
    { id: 'cwmetrics', name: 'CW Metrics', icon: 'Activity', implemented: false, category: 'MONITORING' },
    { id: 'cloudtrail', name: 'CloudTrail', icon: 'ScrollText', implemented: false, category: 'MONITORING' },
    { id: 'config', name: 'Config', icon: 'Settings', implemented: false, category: 'MONITORING' },
  ];

  const categories = Array.from(new Set(resources.map(r => r.category)))
    .filter(c => c !== 'GENERAL')
    .sort((a, b) => a.localeCompare(b));

  const getIcon = (iconName: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const icons: Record<string, any> = {
      LayoutDashboard, Server, Database, DatabaseZap, Zap, Globe, Activity, ScrollText, ShieldCheck, Settings, MessageSquare, Network, Lock, Box, FileCode, Layers, Radio, TableProperties, Key, FileCheck, BarChart3, Settings2, Waves, Mail, RefreshCw, FlaskConical, SearchCode, Truck, HardDrive, Folder, Scale, Cloud, Package, Hammer, Map, FolderOpen, Building, UserSquare, Clock, Save, MousePointer2, Search, Monitor
    };
    const IconComponent = icons[iconName];
    return IconComponent ? <IconComponent size={14} /> : null;
  };

  const getCategoryIcon = (category: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const icons: Record<string, any> = {
      COMPUTE: Cpu,
      STORAGE: HardDrive,
      DATABASE: Database,
      MESSAGING: MessageSquare,
      NETWORKING: Network,
      SECURITY: Lock,
      ANALYTICS: BarChart3,
      MANAGEMENT: Settings,
      MONITORING: Activity,
      INTEGRATION: RefreshCw
    };
    const IconComponent = icons[category];
    return IconComponent ? <IconComponent size={13} className="text-muted-foreground group-hover:text-foreground shrink-0 transition-colors" /> : <Layers size={13} className="text-muted-foreground group-hover:text-foreground shrink-0 transition-colors" />;
  };

  const [recent, setRecent] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ministack_recent');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('ministack_recent', JSON.stringify(recent));
  }, [recent]);

  const handleNavigation = (id: string, isHistoryAction = false) => {
    setActiveTab(id);
    
    if (!isHistoryAction) {
      const newHistory = history.slice(0, historyPointer + 1);
      setHistory([...newHistory, id]);
      setHistoryPointer(newHistory.length);
    }

    // Track recently visited services (exclude home and services catalog itself)
    if (id !== 'home' && id !== 'services') {
      setRecent(prev => {
        const filtered = prev.filter(r => r !== id);
        return [id, ...filtered].slice(0, 10);
      });
    }
  };

  const handleBack = () => {
    if (historyPointer > 0) {
      const nextPointer = historyPointer - 1;
      setHistoryPointer(nextPointer);
      handleNavigation(history[nextPointer], true);
    }
  };

  const handleForward = () => {
    if (historyPointer < history.length - 1) {
      const nextPointer = historyPointer + 1;
      setHistoryPointer(nextPointer);
      handleNavigation(history[nextPointer], true);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home': return <HomeDashboard onNavigate={handleNavigation} />;
      case 'services': return <AllServices onNavigate={handleNavigation} recent={recent} />;
      case 'design-system': return <DesignSystemShowcase />;
      case 'messaging':
      case 'sns': return <MessagingDashboard />;
      case 'ecr': return <ECRDashboard />;
      case 'ecs': return <ECSDashboard />;
      default: return <HomeDashboard onNavigate={handleNavigation} />;
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-background text-foreground overflow-hidden transition-colors duration-300">
      {/* Header / Top Bar */}
      <header className="h-12 bg-card border-b border-border flex items-center justify-between px-4 z-40 shrink-0">
        <div className="flex items-center gap-2 min-w-[280px]">
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-1.5 hover:bg-muted rounded transition-colors text-muted-foreground hover:text-foreground mr-2 cursor-pointer"
          >
            <Menu size={18} />
          </button>
          <div className="w-6 h-6 bg-primary rounded flex items-center justify-center text-primary-foreground shrink-0">
            <Zap size={14} fill="currentColor" />
          </div>
          <h1 className="text-sm font-semibold tracking-tight mr-2 whitespace-nowrap">AWS Console</h1>

          {/* Navigation History Buttons */}
          <div className="flex items-center gap-1 border-l border-border pl-2">
            <button
              onClick={handleBack}
              disabled={historyPointer === 0}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
              title="Back"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={handleForward}
              disabled={historyPointer === history.length - 1}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
              title="Forward"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        
        <div className="absolute inset-x-0 flex justify-center pointer-events-none">
          <div className="relative w-full max-w-2xl pointer-events-auto">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-muted-foreground">
              <Search size={14} />
            </div>
            <input 
              type="text" 
              placeholder="Search services, resources, documentation..." 
              className="w-full bg-background border border-border rounded px-10 py-1.5 text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
              <span className="text-[10px] font-mono bg-card border border-border px-1.5 py-0.5 rounded text-muted-foreground">/</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-muted-foreground justify-end z-10">
          <ThemeSelector 
            themeMode={themeMode}
            setThemeMode={setThemeMode}
            themeColor={themeColor}
            setThemeColor={setThemeColor}
          />
          <div className="flex items-center gap-1.5 text-[0.7rem] font-medium text-muted-foreground hover:text-foreground cursor-pointer border-l border-border pl-4 ml-2">
            <Globe size={14} />
            <div className="flex flex-col items-start leading-none">
              <span>Global</span>
              <span className="text-[0.6rem] font-normal opacity-70">us-east-1</span>
            </div>
            <ChevronDown size={12} />
          </div>
          <Bell size={16} className="hover:text-foreground cursor-pointer" />
          <div className="flex items-center gap-2 pl-4 border-l border-border">
            <div className="w-7 h-7 bg-muted rounded-full overflow-hidden border border-border hover:border-primary cursor-pointer">
              <img src="https://i.pravatar.cc/100?u=admin" alt="profile" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col items-start leading-none cursor-pointer">
              <span className="text-[0.65rem] font-semibold text-foreground">Admin-User</span>
              <span className="text-[0.55rem] font-normal text-muted-foreground">us-east-1</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className={`${isSidebarCollapsed ? 'w-16' : 'w-64'} border-r border-border bg-card flex flex-col shrink-0 relative z-30 transition-all duration-300 ease-in-out overflow-y-auto custom-scrollbar`}>
          <nav className="flex-1 p-0 flex flex-col pt-4">
            <div className={`mb-4 ${isSidebarCollapsed ? 'px-0' : 'px-3'}`}>
              <div className={`flex items-center gap-3 transition-all duration-300 ${isSidebarCollapsed ? 'justify-center py-2' : 'bg-muted/50 rounded-lg p-2 border border-border'}`}>
                <div className={`bg-background border border-border rounded flex items-center justify-center text-foreground shadow-xs shrink-0 transition-all duration-300 ${isSidebarCollapsed ? 'w-9 h-9' : 'w-8 h-8'}`}>
                  <LayoutDashboard size={isSidebarCollapsed ? 18 : 18} />
                </div>
                {!isSidebarCollapsed && (
                  <div className="flex flex-col animate-fade-in">
                    <span className="text-[0.65rem] font-semibold text-foreground">Console Home</span>
                    <span className="text-[0.55rem] text-muted-foreground">Global Infrastructure</span>
                  </div>
                )}
              </div>
            </div>

            {/* Fixed Items */}
            <div className="flex flex-col mb-4">
              {resources.filter(r => r.category === 'GENERAL').map(resource => {
                const isImplemented = resource.implemented;
                const isActive = activeTab === resource.id;
                
                return (
                  <button
                    key={resource.id}
                    onClick={() => isImplemented && handleNavigation(resource.id)}
                    disabled={!isImplemented}
                    title={isSidebarCollapsed ? resource.name : ""}
                    className={`
                      w-full flex items-center gap-3 px-4 py-2 text-xs font-medium transition-all group relative cursor-pointer
                      ${!isImplemented ? 'opacity-30 cursor-not-allowed grayscale' : 'hover:bg-muted/50'}
                      ${isActive ? 'bg-muted text-primary font-semibold' : 'text-muted-foreground'}
                      ${isSidebarCollapsed ? 'justify-center px-0' : ''}
                    `}
                  >
                    {isActive && isSidebarCollapsed && (
                      <div className="absolute left-0 top-1 bottom-1 w-1 bg-primary rounded-r" />
                    )}
                    <div className={`shrink-0 flex items-center justify-center transition-all duration-300 ${isSidebarCollapsed ? 'w-9 h-9 rounded bg-transparent group-hover:bg-background group-hover:shadow-xs group-hover:border group-hover:border-border' : ''} ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}>
                      {getIcon(resource.icon)}
                    </div>
                    {!isSidebarCollapsed && (
                      <span className="animate-fade-in truncate">{resource.name}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {categories.map(category => {
              const categoryResources = resources.filter(r => r.category === category);
              const isOpen = openCategories.includes(category);
              
              if (categoryResources.length === 0) return null;
              
              return (
                <div key={category} className="flex flex-col mb-2">
                  {!isSidebarCollapsed ? (
                    <button 
                      onClick={() => toggleCategory(category)}
                      className="w-full flex items-center justify-between px-4 py-2 mb-1 group hover:bg-muted/30 transition-colors cursor-pointer font-sans"
                    >
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(category)}
                        <h2 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider animate-fade-in">
                          {category}
                        </h2>
                      </div>
                      <div className={`text-muted-foreground group-hover:text-foreground transition-all duration-300 ${isOpen ? 'rotate-0' : '-rotate-90'}`}>
                        <ChevronDown size={10} />
                      </div>
                    </button>
                  ) : (
                    <div className="h-[1px] bg-border mx-4 mb-4" />
                  )}
                  
                  <div className={`flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${isOpen || isSidebarCollapsed ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    {categoryResources.map(resource => {
                      const isImplemented = resource.implemented;
                      const isActive = activeTab === resource.id;
                      
                      return (
                        <button
                          key={resource.id}
                          onClick={() => isImplemented && handleNavigation(resource.id)}
                          disabled={!isImplemented}
                          title={isSidebarCollapsed ? resource.name : ""}
                          className={`
                            w-full flex items-center gap-3 px-4 py-2 text-xs font-medium transition-all group relative cursor-pointer
                            ${!isImplemented ? 'opacity-30 cursor-not-allowed grayscale' : 'hover:bg-muted/50'}
                            ${isActive ? 'bg-muted text-primary' : 'text-muted-foreground'}
                            ${isSidebarCollapsed ? 'justify-center px-0' : ''}
                          `}
                        >
                          {isActive && isSidebarCollapsed && (
                            <div className="absolute left-0 top-1 bottom-1 w-1 bg-primary rounded-r" />
                          )}
                          <div className={`shrink-0 flex items-center justify-center transition-all duration-300 ${isSidebarCollapsed ? 'w-9 h-9 rounded bg-transparent group-hover:bg-background group-hover:shadow-xs group-hover:border group-hover:border-border' : ''} ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}>
                            {getIcon(resource.icon)}
                          </div>
                          {!isSidebarCollapsed && (
                            <span className={`${isActive ? 'font-semibold' : ''} animate-fade-in truncate`}>{resource.name}</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              );
            })}
          </nav>


        </aside>

        {/* Main Content */}
        <main 
          key={activeTab}
          className="flex-1 p-8 overflow-y-auto bg-background"
        >
          <div className="animate-fade-in w-full flex flex-col gap-1">
            <div className="flex items-center gap-2 text-[0.6rem] font-bold text-muted-foreground uppercase tracking-widest mb-1">
              <span>Console</span>
              <span>/</span>
              <span className="text-muted-foreground">{activeTab === 'services' ? 'Service Catalog' : activeTab.toUpperCase()}</span>
            </div>
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
