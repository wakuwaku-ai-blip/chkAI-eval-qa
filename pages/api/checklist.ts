import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../lib/mongoose';
import ChecklistItem from '../../models/ChecklistItem';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await dbConnect();

  switch (req.method) {
    case 'GET':
      try {
        const items = await ChecklistItem.find({});
        res.status(200).json(items);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch checklist items' });
      }
      break;

    case 'POST':
      try {
        const item = await ChecklistItem.create(req.body);
        res.status(201).json(item);
      } catch (error) {
        res.status(500).json({ error: 'Failed to create checklist item' });
      }
      break;

    case 'PUT':
      try {
        const { _id, ...updateData } = req.body;
        const item = await ChecklistItem.findByIdAndUpdate(_id, updateData, { new: true });
        if (!item) {
          return res.status(404).json({ error: 'Item not found' });
        }
        res.status(200).json(item);
      } catch (error) {
        res.status(500).json({ error: 'Failed to update checklist item' });
      }
      break;

    case 'DELETE':
      try {
        const { _id } = req.body;
        if (!_id) {
          return res.status(400).json({ error: 'Missing _id' });
        }
        const deleted = await ChecklistItem.findByIdAndDelete(_id);
        if (!deleted) {
          return res.status(404).json({ error: 'Item not found' });
        }
        res.status(200).json({ message: 'Deleted successfully', _id });
      } catch (error) {
        res.status(500).json({ error: 'Failed to delete checklist item' });
      }
      break;

    default:
      res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 