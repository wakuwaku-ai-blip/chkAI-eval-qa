import { NextApiRequest, NextApiResponse } from 'next';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import formidable from 'formidable';

// JSON body 파싱 함수
const parseJsonBody = (req: NextApiRequest): any => {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
};

// multer 설정
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB 제한
  }
});

// multer를 Promise로 래핑
const uploadMiddleware = (req: any, res: any) => {
  return new Promise((resolve, reject) => {
    upload.single('file')(req, res, (err) => {
      if (err) reject(err);
      else resolve(req.file);
    });
  });
};

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      const form = formidable({
        uploadDir: path.join(process.cwd(), 'public/uploads'),
        keepExtensions: true,
        maxFiles: 1,
        maxFileSize: 10 * 1024 * 1024, // 10MB
      });

      const [fields, files] = await form.parse(req);
      const file = files.file?.[0];

      if (!file) {
        return res.status(400).json({ error: '파일이 업로드되지 않았습니다.' });
      }

      // 확장자 처리: 저장된 파일명에 확장자가 없으면 원본 파일명에서 확장자를 추출해 붙임
      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      const originalExt = path.extname(file.originalFilename || '');
      let savedFilePath = file.filepath;
      let savedFileName = path.basename(savedFilePath);
      // 확장자가 없으면 붙여줌
      if (originalExt && !savedFileName.endsWith(originalExt)) {
        const newFileName = savedFileName + originalExt;
        const newFilePath = path.join(uploadDir, newFileName);
        fs.renameSync(savedFilePath, newFilePath);
        savedFilePath = newFilePath;
        savedFileName = newFileName;
      }
      // 파일 경로를 상대 경로로 변환
      const relativePath = `/uploads/${savedFileName}`;

      res.status(200).json({ filePath: relativePath });
    } catch (error) {
      console.error('파일 업로드 오류:', error);
      res.status(500).json({ error: '파일 업로드에 실패했습니다.' });
    }
  } else if (req.method === 'DELETE') {
    try {
      const body = await parseJsonBody(req);
      console.log('DELETE 요청 받음:', body);
      const { filePath } = body;
      
      if (!filePath) {
        console.log('filePath가 없음');
        return res.status(400).json({ error: 'File path is required' });
      }

      console.log('삭제할 파일 경로:', filePath);

      // 파일 경로에서 실제 파일 시스템 경로 생성
      const fullPath = path.join(process.cwd(), 'public', filePath);
      console.log('전체 파일 경로:', fullPath);
      
      // 파일이 존재하는지 확인
      if (!fs.existsSync(fullPath)) {
        console.log('파일이 존재하지 않음:', fullPath);
        return res.status(404).json({ error: 'File not found', path: fullPath });
      }

      console.log('파일 삭제 시작:', fullPath);
      // 파일 삭제
      fs.unlinkSync(fullPath);
      console.log('파일 삭제 완료:', fullPath);
      
      res.status(200).json({
        message: 'File deleted successfully',
        filePath: filePath
      });
    } catch (error) {
      console.error('Delete error:', error);
      res.status(500).json({ error: 'File deletion failed', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  } else if (req.method === 'GET') {
    // 파일 내용 가져오기
    try {
      const { file } = req.query;
      
      if (!file || typeof file !== 'string') {
        return res.status(400).json({ error: '파일 경로가 필요합니다.' });
      }

      // 파일 경로 보안 검사
      const filePath = path.join(process.cwd(), 'public', file);
      const normalizedPath = path.normalize(filePath);
      
      // uploads 디렉토리 외부 접근 방지
      if (!normalizedPath.includes(path.join(process.cwd(), 'public', 'uploads'))) {
        return res.status(403).json({ error: '접근이 거부되었습니다.' });
      }

      // 파일 존재 확인
      if (!fs.existsSync(normalizedPath)) {
        return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
      }

      // 파일 확장자 확인 (텍스트 파일만 허용)
      const ext = path.extname(normalizedPath).toLowerCase();
      const allowedExtensions = ['.txt', '.md', '.json', '.xml', '.html', '.css', '.js', '.ts', '.jsx', '.tsx', '.csv'];
      
      if (!allowedExtensions.includes(ext)) {
        return res.status(400).json({ error: '지원하지 않는 파일 형식입니다.' });
      }

      // 파일 크기 확인 (1MB 제한)
      const stats = fs.statSync(normalizedPath);
      if (stats.size > 1024 * 1024) {
        return res.status(400).json({ error: '파일이 너무 큽니다. (1MB 제한)' });
      }

      // 파일 내용 읽기
      const content = fs.readFileSync(normalizedPath, 'utf-8');
      
      res.status(200).json({ 
        success: true, 
        content,
        fileName: path.basename(normalizedPath),
        fileSize: stats.size
      });
    } catch (error) {
      console.error('파일 내용 읽기 오류:', error);
      res.status(500).json({ error: '파일 내용을 읽을 수 없습니다.' });
    }
  } else {
    res.setHeader('Allow', ['POST', 'DELETE', 'GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 