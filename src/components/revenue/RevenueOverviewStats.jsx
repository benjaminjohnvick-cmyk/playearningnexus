import { Card, CardContent } from '@/components/ui/card';
import { DollarSign, TrendingUp, Users, Zap, ShoppingCart, BarChart2 } from 'lucide-react';

const STATS = [
  { label: 'Total Revenue', value: '$18,492', change: '+23%', icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' },
  { label: 'Active Subscribers', value: '1,243', change: '+12%', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
  { label: 'In-App Sales', value: '$3,241', change: '+34%', icon: ShoppingCart, color: 'text-purple-600', bg: 'bg-purple-50' },
  { label: 'Ad Revenue', value: '$4,820', change: '+18%', icon: TrendingUp, color: 'text-orange-600', bg: 'bg-orange-50' },
  { label: 'API Revenue', value: '$1,190', change: '+8%', icon: Zap, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { label: 'Report Sales', value: '$2,940', change: '+41%', icon: BarChart2, color: 'text-red-600', bg: 'bg-red-50' },
];

export default function RevenueOverviewStats() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {STATS.map((stat, i) => {
        const Icon = stat.icon;
        return (
          <Card key={i} className="border hover:shadow-md transition-all">
            <CardContent className="p-4">
              <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center mb-2`}>
                <Icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <div className="text-xl font-bold text-gray-900">{stat.value}</div>
              <div className="text-xs text-gray-500">{stat.label}</div>
              <div className="text-xs text-green-600 font-medium mt-0.5">{stat.change} this month</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}