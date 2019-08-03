import { Document, model, Schema, Types } from 'mongoose';
import { IDomain } from './domain';

export interface ILink extends Document {
  banned?: boolean;
  bannedBy?: Types.ObjectId;
  count?: number;
  createdAt?: Date;
  domain?: Types.ObjectId | IDomain;
  id: string;
  password?: string;
  target: string;
  updatedAt?: Date;
  user?: Types.ObjectId;
}

const LinkSchema: Schema = new Schema({
  banned: { type: Boolean, default: false },
  bannedBy: { type: Schema.Types.ObjectId, ref: 'user' },
  count: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  domain: { type: Schema.Types.ObjectId, ref: 'domain' },
  id: { type: String, required: true, trim: true },
  password: { type: String, trim: true },
  target: { type: String, required: true },
  updatedAt: { type: Date, default: Date.now },
  user: { type: Schema.Types.ObjectId, ref: 'user' },
});

const Link = model<ILink>('link', LinkSchema);

export default Link;
