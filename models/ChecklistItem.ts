import mongoose, { Schema, Document } from 'mongoose';

export interface IChecklistItem extends Document {
  category: string;
  subCategory: string;
  item: string;
  itemNumber: string;
  evaluationMethod: string;
  requiredEvidence: string;
  relatedLaw: string;
  details: string;
  status: string; // 이행, 부분이행, 미이행, 해당없음
  resultText?: string;
  resultFiles?: string[];
  progress?: number;
  improvement?: string;
}

const ChecklistItemSchema: Schema = new Schema({
  category: String,
  subCategory: String,
  item: String,
  itemNumber: String,
  evaluationMethod: String,
  requiredEvidence: String,
  relatedLaw: String,
  details: String,
  status: { type: String, default: "" },
  resultText: String,
  resultFiles: [String],
  progress: { type: Number, default: 0 },
  improvement: String,
});

export default mongoose.models.ChecklistItem ||
  mongoose.model<IChecklistItem>('ChecklistItem', ChecklistItemSchema); 