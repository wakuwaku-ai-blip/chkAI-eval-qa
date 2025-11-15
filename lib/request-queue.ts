// lib/request-queue.ts
interface QueuedRequest<T> {
  id: string;
  priority: 'high' | 'medium' | 'low';
  request: () => Promise<T>;
  timestamp: number;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

class PriorityRequestQueue<T> {
  private queue: QueuedRequest<T>[] = [];
  private processing: Set<string> = new Set();
  private maxConcurrent: number;
  private currentConcurrent: number = 0;

  constructor(maxConcurrent: number = 5) {
    this.maxConcurrent = maxConcurrent;
  }

  async enqueue(
    id: string,
    request: () => Promise<T>,
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const queuedRequest: QueuedRequest<T> = {
        id,
        priority,
        request,
        timestamp: Date.now(),
        resolve,
        reject,
      };

      // 우선순위에 따라 정렬하여 삽입
      this.insertByPriority(queuedRequest);
      this.process();
    });
  }

  private insertByPriority(request: QueuedRequest<T>) {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    let insertIndex = this.queue.length;

    for (let i = 0; i < this.queue.length; i++) {
      const currentPriority = priorityOrder[this.queue[i].priority];
      const newPriority = priorityOrder[request.priority];

      if (newPriority > currentPriority) {
        insertIndex = i;
        break;
      } else if (newPriority === currentPriority) {
        // 같은 우선순위면 시간순
        if (request.timestamp < this.queue[i].timestamp) {
          insertIndex = i;
          break;
        }
      }
    }

    this.queue.splice(insertIndex, 0, request);
  }

  private async process() {
    // 최대 동시 처리 수 확인
    if (this.currentConcurrent >= this.maxConcurrent) {
      return;
    }

    // 큐가 비어있으면 종료
    if (this.queue.length === 0) {
      return;
    }

    // 다음 요청 가져오기
    const nextRequest = this.queue.shift();
    if (!nextRequest) return;

    // 이미 처리 중인 요청은 건너뛰기
    if (this.processing.has(nextRequest.id)) {
      this.process(); // 다음 요청 처리
      return;
    }

    this.processing.add(nextRequest.id);
    this.currentConcurrent++;

    try {
      const result = await nextRequest.request();
      nextRequest.resolve(result);
    } catch (error) {
      nextRequest.reject(error as Error);
    } finally {
      this.processing.delete(nextRequest.id);
      this.currentConcurrent--;

      // 다음 요청 처리 (약간의 지연 후)
      setTimeout(() => this.process(), 100);
    }
  }

  getQueueStatus() {
    return {
      queueLength: this.queue.length,
      currentConcurrent: this.currentConcurrent,
      maxConcurrent: this.maxConcurrent,
      processing: Array.from(this.processing),
      queueByPriority: {
        high: this.queue.filter(r => r.priority === 'high').length,
        medium: this.queue.filter(r => r.priority === 'medium').length,
        low: this.queue.filter(r => r.priority === 'low').length,
      },
    };
  }

  clear() {
    this.queue = [];
    this.processing.clear();
    this.currentConcurrent = 0;
  }
}

// 전역 요청 큐 인스턴스
const maxConcurrent = parseInt(process.env.MAX_CONCURRENT_REQUESTS || '5', 10);
export const geminiRequestQueue = new PriorityRequestQueue(maxConcurrent);

