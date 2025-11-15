// pages/load-test.tsx
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Button, Form, InputNumber, Select, Card, Progress, Table, Alert, Spin } from 'antd';
import { ArrowLeftOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function LoadTest() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [testId, setTestId] = useState<string | null>(null);
  const [results, setResults] = useState<any>(null);
  const [polling, setPolling] = useState(false);

  const handleRunTest = async (values: any) => {
    setLoading(true);
    try {
      const res = await fetch('/api/load-test/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concurrentUsers: values.concurrentUsers,
          requestsPerUser: values.requestsPerUser,
          endpoint: values.endpoint,
          requestData: {
            evaluationMethod: '테스트 평가 방법',
            requiredEvidence: '테스트 필요 증빙',
            resultText: '테스트 이행현황 내용',
            resultFiles: [],
          },
          duration: values.duration || 60,
        }),
      });
      const data = await res.json();
      setTestId(data.testId);
      setPolling(true);
      pollResults(data.testId);
    } catch (error) {
      console.error('테스트 실행 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const pollResults = async (id: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/load-test/results?testId=${id}`);
        const data = await res.json();
        
        if (data.endTime) {
          // 테스트 완료
          setResults(data);
          setPolling(false);
          clearInterval(interval);
        } else {
          // 테스트 진행 중
          setResults(data);
        }
      } catch (error) {
        console.error('결과 조회 실패:', error);
        clearInterval(interval);
        setPolling(false);
      }
    }, 2000); // 2초마다 폴링

    // 5분 후 자동 중지
    setTimeout(() => {
      clearInterval(interval);
      setPolling(false);
    }, 5 * 60 * 1000);
  };

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
          <ThunderboltOutlined /> 부하 테스트
        </h1>
      </div>
      
      <Card title="테스트 설정" style={{ marginBottom: 16 }}>
        <Form
          onFinish={handleRunTest}
          layout="vertical"
          initialValues={{
            concurrentUsers: 5,
            requestsPerUser: 2,
            endpoint: '/api/evaluate',
            duration: 60,
          }}
        >
          <Form.Item
            label="동시 사용자 수"
            name="concurrentUsers"
            rules={[{ required: true, message: '동시 사용자 수를 입력해주세요.' }]}
          >
            <InputNumber min={1} max={100} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="사용자당 요청 수"
            name="requestsPerUser"
            rules={[{ required: true, message: '사용자당 요청 수를 입력해주세요.' }]}
          >
            <InputNumber min={1} max={10} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="엔드포인트"
            name="endpoint"
            rules={[{ required: true, message: '엔드포인트를 선택해주세요.' }]}
          >
            <Select>
              <Select.Option value="/api/evaluate">/api/evaluate</Select.Option>
              <Select.Option value="/api/qa">/api/qa</Select.Option>
              <Select.Option value="/api/evaluation-improvement-qa">/api/evaluation-improvement-qa</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="테스트 지속 시간 (초)"
            name="duration"
          >
            <InputNumber min={10} max={300} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} disabled={polling}>
              테스트 실행
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {testId && (
        <Card title="테스트 진행 상황" style={{ marginBottom: 16 }}>
          {polling && (
            <Alert
              message="테스트 진행 중..."
              description="결과는 자동으로 업데이트됩니다."
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}
          {results?.summary && (
            <div>
              <h3>결과 요약</h3>
              <Table
                dataSource={[
                  { key: '1', label: '총 요청 수', value: results.summary.totalRequests },
                  { key: '2', label: '성공 요청', value: results.summary.successfulRequests },
                  { key: '3', label: '실패 요청', value: results.summary.failedRequests },
                  { key: '4', label: '성공률', value: `${results.summary.successRate.toFixed(2)}%` },
                  { key: '5', label: '평균 응답 시간', value: `${results.summary.avgResponseTime.toFixed(2)}ms` },
                  { key: '6', label: '최소 응답 시간', value: `${results.summary.minResponseTime}ms` },
                  { key: '7', label: '최대 응답 시간', value: `${results.summary.maxResponseTime}ms` },
                  { key: '8', label: '초당 요청 수', value: `${results.summary.requestsPerSecond.toFixed(2)}` },
                ]}
                columns={[
                  { title: '항목', dataIndex: 'label', key: 'label' },
                  { title: '값', dataIndex: 'value', key: 'value' },
                ]}
                pagination={false}
              />
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

