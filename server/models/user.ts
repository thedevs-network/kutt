import { Document, model, Schema, Types } from 'mongoose';

import { IDomain } from './domain';

export interface IUser extends Document {
  apikey?: string;
  banned?: boolean;
  bannedBy?: Types.ObjectId;
  cooldowns?: Date[];
  createdAt?: Date;
  domain?: Types.ObjectId | IDomain;
  email: string;
  password: string;
  resetPasswordExpires?: Date;
  resetPasswordToken?: string;
  updatedAt?: Date;
  verificationExpires?: Date;
  verificationToken?: string;
  verified?: boolean;
}

const UserSchema: Schema = new Schema({
  apikey: { type: String, unique: true },
  banned: { type: Boolean, default: false },
  bannedBy: { type: Schema.Types.ObjectId, ref: 'user' },
  cooldowns: [Date],
  createdAt: { type: Date, default: Date.now },
  domain: { type: Schema.Types.ObjectId, ref: 'domain' },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    unique: true,
  },
  password: { type: String, required: true },
  resetPasswordExpires: { type: Date },
  resetPasswordToken: { type: String },
  updatedAt: { type: Date, default: Date.now },
  verificationExpires: { type: Date },
  verificationToken: { type: String },
  verified: { type: Boolean, default: false },
});

const User = model<IUser>('user', UserSchema);

export default User;
