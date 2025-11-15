// pages/dashboard.tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Button, Card, Statistic, Table, Alert, Spin } from 'antd';
import { ArrowLeftOutlined, BarChartOutlined } from '@ant-design/icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface MetricsSummary {
  requestsPerMinute: number;
  tokensPerMinute: number;
  requestsPerHour: number;
  tokensPerHour: number;
  costPerHour: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  errorRate: number;
  totalTokens: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCachedTokens: number;
  totalCost: number;
  avgDuration: number;
}

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  const [metrics, setMetrics] = useState<any[]>([]);

  const fetchMetrics = async () => {
    try {
      const res = await fetch('/api/metrics?timeRange=hour');
      const data = await res.json();
      setSummary(data.summary);
      
      // 시간별 데이터 준비 (그래프용)
      const hourlyData = prepareHourlyData(data.metrics);
      setMetrics(hourlyData);
    } catch (error) {
      console.error('메트릭 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const prepareHourlyData = (metrics: any[]) => {
    // 시간별로 그룹화
    const hourlyMap = new Map<string, { requests: number; tokens: number; cost: number }>();
    
    metrics.forEach(m => {
      const hour = new Date(m.timestamp).toISOString().substring(0, 13) + ':00';
      const existing = hourlyMap.get(hour) || { requests: 0, tokens: 0, cost: 0 };
      existing.requests += 1;
      existing.tokens += m.totalTokens;
      existing.cost += m.cost;
      hourlyMap.set(hour, existing);
    });

    return Array.from(hourlyMap.entries()).map(([time, data]) => ({
      time: time.substring(11, 16), // HH:MM 형식
      requests: data.requests,
      tokens: data.tokens,
      cost: data.cost,
    })).sort((a, b) => a.time.localeCompare(b.time));
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // 30초마다
    return () => clearInterval(interval);
  }, []);

  if (loading && !summary) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!summary) {
    return (
      <div style={{ padding: 24 }}>
        <Alert message="데이터를 불러올 수 없습니다." type="error" />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
        <Button 
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push('/')}
        >
          뒤로가기
        </Button>
        <h1 style={{ margin: 0 }}>
          <BarChartOutlined /> 사용량 모니터링 대시보드
        </h1>
      </div>

      {/* 경고 표시 */}
      {summary.errorRate > 0.1 && (
        <Alert
          message="높은 에러율 감지"
          description={`에러율이 ${(summary.errorRate * 100).toFixed(2)}%입니다.`}
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {summary.requestsPerMinute > 10 && (
        <Alert
          message="높은 요청량"
          description={`분당 ${summary.requestsPerMinute}개 요청이 발생하고 있습니다.`}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 통계 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 16 }}>
        <Card>
          <Statistic
            title="총 요청 수 (1일)"
            value={summary.totalRequests}
            suffix="건"
            description={`성공: ${summary.successfulRequests}건, 실패: ${summary.failedRequests}건`}
          />
        </Card>
        <Card>
          <Statistic
            title="성공률"
            value={(1 - summary.errorRate) * 100}
            precision={2}
            suffix="%"
          />
        </Card>
        <Card>
          <Statistic
            title="총 토큰 (1일)"
            value={summary.totalTokens.toLocaleString()}
            suffix="토큰"
            description={`입력: ${summary.totalInputTokens.toLocaleString()}, 출력: ${summary.totalOutputTokens.toLocaleString()}`}
          />
        </Card>
        <Card>
          <Statistic
            title="총 비용 (1일)"
            value={summary.totalCost}
            precision={6}
            prefix="$"
            description={`시간당: $${summary.costPerHour.toFixed(6)}`}
          />
        </Card>
      </div>

      {/* 실시간 사용량 카드 */}
      <Card title="실시간 사용량 (최근 1분)" style={{ marginTop: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          <Statistic
            title="분당 요청 수 (RPM)"
            value={summary.requestsPerMinute}
            suffix="RPM"
            valueStyle={{ color: summary.requestsPerMinute > 10 ? '#cf1322' : '#3f8600' }}
          />
          <Statistic
            title="분당 토큰 수 (TPM)"
            value={summary.tokensPerMinute.toLocaleString()}
            suffix="TPM"
            valueStyle={{ color: summary.tokensPerMinute > 800000 ? '#cf1322' : '#3f8600' }}
          />
        </div>
      </Card>

      {/* 그래프 섹션 */}
      {metrics.length > 0 && (
        <Card title="시간별 사용량 추이" style={{ marginTop: 16 }}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={metrics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="requests" stroke="#8884d8" name="요청 수" />
              <Line yAxisId="right" type="monotone" dataKey="tokens" stroke="#82ca9d" name="토큰 수" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {metrics.length > 0 && (
        <Card title="시간별 비용 추이" style={{ marginTop: 16 }}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={metrics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip formatter={(value: number) => `$${value.toFixed(6)}`} />
              <Legend />
              <Line type="monotone" dataKey="cost" stroke="#ff7300" name="비용 ($)" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* 상세 메트릭 */}
      <Card title="상세 통계 (실제 API 사용량 기반)" style={{ marginTop: 16 }}>
        <Table
          dataSource={[
            { key: '1', label: '평균 응답 시간', value: `${summary.avgDuration.toFixed(2)}ms` },
            { key: '2', label: '분당 요청 수 (RPM)', value: `${summary.requestsPerMinute} RPM` },
            { key: '3', label: '분당 토큰 수 (TPM)', value: `${summary.tokensPerMinute.toLocaleString()} TPM` },
            { key: '4', label: '시간당 요청 수', value: `${summary.requestsPerHour}건` },
            { key: '5', label: '시간당 토큰 수', value: `${summary.tokensPerHour.toLocaleString()} 토큰` },
            { key: '6', label: '시간당 비용', value: `$${summary.costPerHour.toFixed(6)}` },
            { key: '7', label: '캐시된 토큰 (1일)', value: `${summary.totalCachedTokens.toLocaleString()} 토큰` },
          ]}
          columns={[
            { title: '항목', dataIndex: 'label', key: 'label' },
            { title: '값 (실제 API 응답 기반)', dataIndex: 'value', key: 'value' },
          ]}
          pagination={false}
        />
        <Alert
          message="모든 값은 Gemini API 응답의 usageMetadata에서 추출한 실제 값입니다."
          type="info"
          showIcon
          style={{ marginTop: 16 }}
        />
      </Card>
    </div>
  );
}

