import { Document, model, Schema, Types } from 'mongoose';

export interface IHost extends Document {
  address: string;
  banned?: boolean;
  bannedBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
  user?: Types.ObjectId;
}

const HostSchema: Schema = new Schema({
  address: { type: String, unique: true, trim: true, required: true },
  banned: { type: Boolean, default: false },
  bannedBy: { type: Schema.Types.ObjectId, ref: 'user' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  user: { type: Schema.Types.ObjectId, ref: 'user' },
});

const Host = model<IHost>('host', HostSchema);

export default Host;
