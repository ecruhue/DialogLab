import React from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { formatTime } from './verificationUtils';
import type { VerificationData } from './VerificationPlayer';

export interface Participant {
  id: string;
  name: string;
  color: string;
}

interface ConversationMetricsDashboardProps {
  data: VerificationData;
}

// Define types for chart data
interface SpeakingTimeDataEntry {
  name: string;
  value: number;
  color: string;
}

interface TurnDataEntry {
  name: string;
  turns: number;
  color: string;
}

interface RadarDataEntry {
  subject: string;
  [key: string]: string | number; // Index signature for dynamic participant names
}

interface TimelineDataEntry {
  time: string;
  [key: string]: string | number; // Index signature for dynamic participant names
}

interface OverallMetricEntry {
  name: string;
  value: number;
}

const ConversationMetricsDashboard: React.FC<ConversationMetricsDashboardProps> = ({ data }) => {
  // Filter out System participant
  const participants = data.participants.filter(p => p.name !== 'System');
  
  // Speaking time data for pie chart
  const speakingTimeData: SpeakingTimeDataEntry[] = participants.map((participant: Participant) => ({
    name: participant.name,
    value: data.metrics.participationTime[participant.id] || 0,
    color: participant.color
  }));

  // Generate engagement data for visualization
  const engagementData = participants.map((participant: Participant) => ({
    name: participant.name,
    engagement: Math.round((data.metrics.engagementLevel[participant.id] || 0) * 100),
    color: participant.color
  }));

  // Generate timeline data (simplified version)
  const duration = data.duration;
  const timeStep = Math.max(Math.floor(duration / 5), 1); // Create 5 time steps or more
  const timelineData: TimelineDataEntry[] = [];
  
  for (let time = 0; time <= duration; time += timeStep) {
    const timePoint: TimelineDataEntry = { time: formatTime(time) };
    participants.forEach((participant: Participant) => {
      // Simplification: assuming linear growth of speaking time
      const speakingRatio = data.metrics.participationTime[participant.id] / duration || 0;
      timePoint[participant.name] = Math.min(Math.round(speakingRatio * time), data.metrics.participationTime[participant.id] || 0);
    });
    timelineData.push(timePoint);
  }
  
  // Radar chart data
  const radarData: RadarDataEntry[] = [
    { subject: 'Topic Coherence', ...participants.reduce<Record<string, number>>((acc: Record<string, number>, p: Participant) => {
      acc[p.name] = normalizeValue(data.metrics.coherenceScore || 0, 0, 1, 0, 10);
      return acc;
    }, {}) },
    { subject: 'Engagement', ...participants.reduce<Record<string, number>>((acc: Record<string, number>, p: Participant) => {
      acc[p.name] = normalizeValue(data.metrics.engagementLevel[p.id] || 0, 0, 1, 0, 10);
      return acc;
    }, {}) },
    { subject: 'Turn Taking', ...participants.reduce<Record<string, number>>((acc: Record<string, number>, p: Participant) => {
      const maxTurns = Math.max(...Object.values(data.metrics.turnTakingFrequency));
      acc[p.name] = normalizeValue(data.metrics.turnTakingFrequency[p.id] || 0, 0, maxTurns, 0, 10);
      return acc;
    }, {}) },
    { subject: 'Speaking Time', ...participants.reduce<Record<string, number>>((acc: Record<string, number>, p: Participant) => {
      acc[p.name] = normalizeValue(data.metrics.participationTime[p.id] || 0, 0, duration * 0.6, 0, 10);
      return acc;
    }, {}) },
    { subject: 'Sentiment', ...participants.reduce<Record<string, number>>((acc: Record<string, number>, p: Participant) => {
      acc[p.name] = normalizeValue(data.metrics.sentiment[p.id] || 0, -1, 1, 0, 10);
      return acc;
    }, {}) }
  ];
  
  // Overall metrics - exclude System participant from calculations
  const overallMetrics: OverallMetricEntry[] = [
    { name: 'Participation Balance', value: data.metrics.speakingBalance },
    { name: 'Topic Coherence', value: data.metrics.coherenceScore },
    { name: 'Overall Sentiment', value: data.metrics.overallSentiment }
  ];

  // Helper function to normalize values to a specific range
  function normalizeValue(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
    return outMin + ((value - inMin) * (outMax - outMin)) / (inMax - inMin);
  }

  // Custom legend for all participants
  const CustomLegend = () => (
    <div className="flex flex-wrap justify-center items-center gap-2 mt-1 px-1 py-2 bg-white rounded-lg border">
      {participants.map(participant => (
        <div key={`legend-${participant.id}-${participant.name}`} className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: participant.color }}></div>
          <span className="text-[15px]">{participant.name}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="max-w-full bg-transparent text-sm">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-1">
        {/* Left Section - 2/3 width */}
        <div className="lg:col-span-2 space-y-1">
          {/* Summary Cards Row */}
          <div className="grid grid-cols-3 gap-1">
            {overallMetrics.map((metric) => (
              <div key={metric.name} className="bg-white p-2 rounded-lg border">
                <h3 className="text-sm font-medium text-gray-500">{metric.name}</h3>
                <div className="mt-0.5 flex items-baseline">
                  <span className="text-base font-semibold text-gray-900">
                    {(metric.value * 100).toFixed(0)}%
                  </span>
                  <div className="ml-1 h-2 w-full bg-gray-200 rounded-full">
                    <div 
                      className="h-2 rounded-full bg-blue-600" 
                      style={{ width: `${metric.value * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Charts Row - Three charts in one row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-1">
            {/* Speaking Distribution */}
            <div className="bg-white p-2 rounded-lg border">
              <h2 className="text-sm font-semibold mb-1">Speaking Time Distribution</h2>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <Pie
                    data={speakingTimeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={45}
                    fill="#8884d8"
                    dataKey="value"
                    label={({name, percent}: {name: string, percent: number}) => `${(percent * 100).toFixed(0)}%`}
                  >
                    {speakingTimeData.map((entry) => (
                      <Cell key={`pie-cell-${entry.name}-${entry.value}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${value.toFixed(2)} seconds`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            {/* Engagement Levels */}
            <div className="bg-white p-2 rounded-lg border">
              <h2 className="text-sm font-semibold mb-1">Engagement Levels</h2>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={engagementData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} label={{ value: '%', angle: -90, position: 'insideLeft', style: { fontSize: 8 } }} />
                  <Tooltip formatter={(value) => [`${Number(value).toFixed(2)}%`, 'Engagement']} />
                  <Bar dataKey="engagement" name="Engagement Level">
                    {engagementData.map((entry) => (
                      <Cell key={`bar-cell-${entry.name}-${entry.engagement}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            
            {/* Speaking Timeline */}
            <div className="bg-white p-2 rounded-lg border">
              <h2 className="text-sm font-semibold mb-1">Cumulative Speaking Time</h2>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={timelineData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} label={{ value: 'Sec', angle: -90, position: 'insideLeft', style: { fontSize: 8 } }} />
                  <Tooltip formatter={(value, name) => [Number(value).toFixed(2), name]} />
                  {participants.map(participant => (
                    <Line 
                      key={participant.id}
                      type="monotone" 
                      dataKey={participant.name} 
                      stroke={participant.color}
                      strokeWidth={1.5}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right Section - 1/3 width - Larger Participant Comparison */}
        <div>
          <div className="bg-white p-2 rounded-lg border h-full">
            <h2 className="text-sm font-semibold mb-1">Participant Comparison (0 ~ 10)</h2>
            <ResponsiveContainer width="100%" height={210}>
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => Number(value).toFixed(2)} />
                {participants.map(participant => (
                  <Radar 
                    key={participant.id}
                    name={participant.name}
                    dataKey={participant.name}
                    stroke={participant.color}
                    fill={participant.color}
                    fillOpacity={0.2}
                    strokeWidth={1.5}
                  />
                ))}
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      {/* Unified legend */}
      <CustomLegend />
    </div>
  );
};

export default ConversationMetricsDashboard; 