// models/EvaluationJob.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IEvaluationJob extends Document {
  jobId: string;
  itemId: string; // ChecklistItem의 _id
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: 'high' | 'medium' | 'low';

  // 평가 입력 데이터
  evaluationMethod: string;
  requiredEvidence: string;
  resultText: string;
  resultFiles: string[];
  implementationStatus?: string;

  // 평가 결과
  result?: {
    progress: number;
    improvement: string;
    basis: string;
    evidenceAnalysis: any;
  };

  // 메타데이터
  attempts: number;
  maxAttempts: number;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  nextRetryAt?: Date;
}

const EvaluationJobSchema: Schema = new Schema({
  jobId: { type: String, required: true, unique: true, index: true },
  itemId: { type: String, required: true, index: true },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
    index: true,
  },
  priority: {
    type: String,
    enum: ['high', 'medium', 'low'],
    default: 'medium',
  },
  evaluationMethod: String,
  requiredEvidence: String,
  resultText: String,
  resultFiles: [String],
  implementationStatus: String,
  result: Schema.Types.Mixed,
  attempts: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 3 },
  error: String,
  createdAt: { type: Date, default: Date.now, index: true },
  startedAt: Date,
  completedAt: Date,
  nextRetryAt: Date,
}, {
  timestamps: true,
});

export default mongoose.models.EvaluationJob ||
  mongoose.model<IEvaluationJob>('EvaluationJob', EvaluationJobSchema);

