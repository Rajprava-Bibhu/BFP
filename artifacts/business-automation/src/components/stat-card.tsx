import { ReactNode } from "react";
import { Card, CardContent } from "./ui/card";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  description?: string;
  trend?: {
    value: number;
    isPositive: boolean;
    label?: string;
  };
  delay?: number;
  accentColor?: string;
  sparkData?: number[];
  badge?: string;
}

export function StatCard({ title, value, icon, description, trend, delay = 0, accentColor = "primary", sparkData, badge }: StatCardProps) {
  const colorMap: Record<string, { bg: string; text: string; spark: string; border: string }> = {
    primary: { bg: "bg-primary/10", text: "text-primary", spark: "#4f46e5", border: "hover:border-primary/30" },
    blue: { bg: "bg-blue-500/10", text: "text-blue-600", spark: "#3b82f6", border: "hover:border-blue-300" },
    emerald: { bg: "bg-emerald-500/10", text: "text-emerald-600", spark: "#10b981", border: "hover:border-emerald-300" },
    violet: { bg: "bg-violet-500/10", text: "text-violet-600", spark: "#7c3aed", border: "hover:border-violet-300" },
    orange: { bg: "bg-orange-500/10", text: "text-orange-600", spark: "#f97316", border: "hover:border-orange-300" },
    rose: { bg: "bg-rose-500/10", text: "text-rose-600", spark: "#f43f5e", border: "hover:border-rose-300" },
    cyan: { bg: "bg-cyan-500/10", text: "text-cyan-600", spark: "#06b6d4", border: "hover:border-cyan-300" },
  };

  const c = colorMap[accentColor] || colorMap.primary;
  const sparkChartData = sparkData?.map((v, i) => ({ v, i }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Card className={`rounded-2xl border-border/50 shadow-sm hover:shadow-lg transition-all duration-300 bg-card overflow-hidden group ${c.border}`}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
              {badge && (
                <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${c.bg} ${c.text}`}>{badge}</span>
              )}
            </div>
            <div className={`p-2.5 ${c.bg} rounded-xl ${c.text} group-hover:scale-110 transition-transform duration-300 flex-shrink-0`}>
              {icon}
            </div>
          </div>

          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-2xl sm:text-3xl font-display font-bold text-foreground leading-none mb-1">{value}</h2>
              {trend && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  {trend.value === 0 ? (
                    <Minus className="h-3.5 w-3.5 text-slate-400" />
                  ) : trend.isPositive ? (
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
                  )}
                  <span className={`text-xs font-semibold ${trend.isPositive ? "text-emerald-600" : "text-rose-600"}`}>
                    {trend.isPositive ? "+" : "-"}{Math.abs(trend.value)}%
                  </span>
                  {trend.label && <span className="text-xs text-muted-foreground">{trend.label}</span>}
                </div>
              )}
              {description && !trend && (
                <p className="mt-1.5 text-xs text-muted-foreground">{description}</p>
              )}
            </div>
            {sparkChartData && sparkChartData.length > 0 && (
              <div className="h-12 w-20 opacity-60 group-hover:opacity-100 transition-opacity">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sparkChartData}>
                    <defs>
                      <linearGradient id={`spark-${accentColor}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={c.spark} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={c.spark} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="v" stroke={c.spark} strokeWidth={2} fill={`url(#spark-${accentColor})`} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
