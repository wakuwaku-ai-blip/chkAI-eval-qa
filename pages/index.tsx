import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useTable, useResizeColumns, useFlexLayout, Column } from 'react-table';
import { Button as AntButton } from 'antd';
import type { ButtonProps } from 'antd';
import { useRouter } from 'next/router';

interface ChecklistItem {
  _id?: string;
  category: string;
  subCategory: string;
  item: string;
  itemNumber: string;
  evaluationMethod: string;
  requiredEvidence: string;
  relatedLaw: string;
  details: string;
  status: string;
  resultText?: string;
  resultFiles?: string[];
  progress?: number;
  improvement?: string;
}

const fetchChecklist = async (): Promise<ChecklistItem[]> => {
  const res = await fetch('/api/checklist');
  return res.json();
};

// 파일 미리보기 모달 컴포넌트
const FilePreviewModal = ({ 
  file, 
  isOpen, 
  onClose 
}: { 
  file: string; 
  isOpen: boolean; 
  onClose: () => void; 
}) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const fileName = file.split('/').pop() || file;
  const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';

  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(fileExtension);
  const isPdf = fileExtension === 'pdf';
  const isText = ['txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts', 'jsx', 'tsx', 'csv'].includes(fileExtension);
  const isOffice = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(fileExtension);
  const isHwp = fileExtension === 'hwp';

  useEffect(() => {
    if (!isOpen || !file) return;

    setLoading(true);
    setError('');
    setContent('');

    if (isText) {
      // 텍스트 파일 내용 가져오기
      fetch(`/api/upload/content?file=${encodeURIComponent(file)}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setContent(data.content);
          } else {
            setError('파일 내용을 불러올 수 없습니다.');
          }
        })
        .catch(() => {
          setError('파일 내용을 불러오는 중 오류가 발생했습니다.');
        })
        .finally(() => {
          setLoading(false);
        });
    } else if (isHwp) {
      // HWP 파일은 바이너리 파일이므로 미리보기 불가
      setContent('한글 문서 파일(.hwp)은 바이너리 형식으로 미리보기를 지원하지 않습니다.\n\n파일명: ' + fileName);
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [isOpen, file, isText]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          maxWidth: '90vw',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #edebe9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#f8f9fa'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px', fontWeight: '600', color: '#323130' }}>
              파일 미리보기
            </span>
            <span style={{ fontSize: '14px', color: '#666', fontStyle: 'italic' }}>
              {fileName}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: '#666',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            ✕
          </button>
        </div>

        {/* 컨텐츠 */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
          {loading ? (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              height: '200px',
              color: '#666'
            }}>
              파일을 불러오는 중...
            </div>
          ) : error ? (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              height: '200px',
              color: '#ff4d4f',
              textAlign: 'center'
            }}>
              {error}
            </div>
          ) : isImage ? (
            <div style={{ textAlign: 'center' }}>
              <img 
                src={file} 
                alt={fileName}
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: '70vh',
                  borderRadius: '4px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                }}
              />
            </div>
          ) : isPdf ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                padding: '40px',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                border: '2px dashed #dee2e6'
              }}>
                <div style={{ fontSize: '48px', color: '#6c757d', marginBottom: '16px' }}>📄</div>
                <div style={{ fontSize: '16px', color: '#495057', marginBottom: '8px' }}>
                  PDF 파일
                </div>
                <div style={{ fontSize: '14px', color: '#6c757d', marginBottom: '20px' }}>
                  브라우저에서 직접 열어보세요
                </div>
                <a 
                  href={file} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#0078d4',
                    color: 'white',
                    textDecoration: 'none',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#106ebe'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0078d4'}
                >
                  새 탭에서 열기
                </a>
              </div>
            </div>
          ) : isText ? (
            <div style={{
              backgroundColor: '#f8f9fa',
              border: '1px solid #e9ecef',
              borderRadius: '6px',
              padding: '16px',
              fontFamily: 'Consolas, Monaco, "Courier New", monospace',
              fontSize: '14px',
              lineHeight: '1.5',
              whiteSpace: 'pre-wrap',
              overflow: 'auto',
              maxHeight: '60vh'
            }}>
              {content || '파일 내용이 없습니다.'}
            </div>
          ) : isHwp ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                padding: '40px',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                border: '2px dashed #dee2e6'
              }}>
                <div style={{ fontSize: '48px', color: '#6c757d', marginBottom: '16px' }}>📝</div>
                <div style={{ fontSize: '16px', color: '#495057', marginBottom: '8px' }}>
                  한글 문서
                </div>
                <div style={{ fontSize: '14px', color: '#6c757d', marginBottom: '20px' }}>
                  바이너리 형식으로 미리보기를 지원하지 않습니다
                </div>
                <div style={{
                  backgroundColor: '#fff',
                  border: '1px solid #e9ecef',
                  borderRadius: '6px',
                  padding: '16px',
                  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  whiteSpace: 'pre-wrap',
                  textAlign: 'left',
                  maxHeight: '200px',
                  overflow: 'auto'
                }}>
                  {content}
                </div>
              </div>
            </div>
          ) : isOffice ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                padding: '40px',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                border: '2px dashed #dee2e6'
              }}>
                <div style={{ fontSize: '48px', color: '#6c757d', marginBottom: '16px' }}>📊</div>
                <div style={{ fontSize: '16px', color: '#495057', marginBottom: '8px' }}>
                  Office 문서
                </div>
                <div style={{ fontSize: '14px', color: '#6c757d', marginBottom: '20px' }}>
                  다운로드하여 확인하세요
                </div>
                <a 
                  href={file} 
                  download
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    textDecoration: 'none',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#218838'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#28a745'}
                >
                  다운로드
                </a>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                padding: '40px',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                border: '2px dashed #dee2e6'
              }}>
                <div style={{ fontSize: '48px', color: '#6c757d', marginBottom: '16px' }}>📁</div>
                <div style={{ fontSize: '16px', color: '#495057', marginBottom: '8px' }}>
                  지원하지 않는 파일 형식
                </div>
                <div style={{ fontSize: '14px', color: '#6c757d', marginBottom: '20px' }}>
                  다운로드하여 확인하세요
                </div>
                <a 
                  href={file} 
                  download
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    textDecoration: 'none',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#5a6268'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#6c757d'}
                >
                  다운로드
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 구버전 파일 안내 모달 컴포넌트
const OldFileWarningModal = ({
  isOpen,
  fileName,
  fileType,
  onConfirm,
  onCancel
}: {
  isOpen: boolean;
  fileName: string;
  fileType: 'doc' | 'ppt';
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  if (!isOpen) return null;

  const fileTypeName = fileType === 'doc' ? 'Word' : 'PowerPoint';
  const fileExtension = fileType === 'doc' ? '.doc' : '.ppt';
  const recommendedFormats = fileType === 'doc' ? 'PDF 또는 DOCX' : 'PDF';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2000,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          width: '90%',
          maxWidth: '600px',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div style={{
          padding: '20px',
          borderBottom: '2px solid #faad14',
          backgroundColor: '#fff7e6',
          borderRadius: '8px 8px 0 0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>⚠️</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#faad14' }}>
                구버전 {fileTypeName} 파일 업로드 안내
              </h2>
              <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>
                파일: {fileName}
              </div>
            </div>
          </div>
        </div>

        {/* 내용 */}
        <div style={{ padding: '20px' }}>
          <div style={{
            padding: '15px',
            backgroundColor: '#fff7e6',
            borderRadius: '6px',
            border: '1px solid #ffd591',
            marginBottom: '20px'
          }}>
            <div style={{ fontSize: '14px', lineHeight: '1.6', color: '#d46b08' }}>
              <strong>구버전 {fileTypeName} 파일({fileExtension})은 자동 분석이 불가능합니다.</strong><br/>
              정확한 평가를 위해 {recommendedFormats}로 변환하여 업로드하는 것을 권장합니다.
            </div>
          </div>

          {/* 변환 방법 */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              fontSize: '16px',
              fontWeight: 'bold',
              color: '#1890ff',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>📄</span>
              <span>{recommendedFormats} 변환 방법 ({fileTypeName})</span>
            </div>
            <div style={{
              padding: '15px',
              backgroundColor: '#f0f5ff',
              borderRadius: '6px',
              border: '1px solid #adc6ff',
              fontSize: '14px',
              lineHeight: '1.8',
              color: '#0050b3'
            }}>
              <div style={{ marginBottom: '8px' }}>
                <strong>1단계:</strong> {fileTypeName}에서 파일 열기
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>2단계:</strong> 메뉴에서 <strong>"파일"</strong> → <strong>"다른 이름으로 저장"</strong> 선택
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>3단계:</strong> 파일 형식을 <strong>"{recommendedFormats}"</strong> 선택
              </div>
              <div>
                <strong>4단계:</strong> 변환된 파일을 다시 업로드
              </div>
            </div>
          </div>

          {/* 추가 안내 */}
          <div style={{
            padding: '12px',
            backgroundColor: '#f6ffed',
            borderRadius: '6px',
            border: '1px solid #b7eb8f',
            fontSize: '13px',
            color: '#389e0d',
            textAlign: 'center'
          }}>
            💡 <strong>{recommendedFormats} 변환을 권장합니다.</strong> 변환된 파일은 자동 분석이 가능하여 더 정확한 평가가 가능합니다.
          </div>
        </div>

        {/* 버튼 */}
        <div style={{
          padding: '20px',
          borderTop: '1px solid #e9ecef',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '10px',
          backgroundColor: '#fafafa'
        }}>
          <button
            onClick={onCancel}
            style={{
              padding: '10px 20px',
              backgroundColor: '#f5f5f5',
              color: '#666',
              border: '1px solid #d9d9d9',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#e8e8e8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#f5f5f5';
            }}
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '10px 20px',
              backgroundColor: '#faad14',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#ffc53d';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#faad14';
            }}
          >
            그래도 업로드
          </button>
        </div>
      </div>
    </div>
  );
};

// HWP 파일 안내 모달 컴포넌트
const HwpWarningModal = ({
  isOpen,
  fileName,
  onConfirm,
  onCancel
}: {
  isOpen: boolean;
  fileName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2000,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          width: '90%',
          maxWidth: '600px',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div style={{
          padding: '20px',
          borderBottom: '2px solid #ff4d4f',
          backgroundColor: '#fff2f0',
          borderRadius: '8px 8px 0 0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>⚠️</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#ff4d4f' }}>
                HWP 파일 업로드 안내
              </h2>
              <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>
                파일: {fileName}
              </div>
            </div>
          </div>
        </div>

        {/* 내용 */}
        <div style={{ padding: '20px' }}>
          <div style={{
            padding: '15px',
            backgroundColor: '#fff7e6',
            borderRadius: '6px',
            border: '1px solid #ffd591',
            marginBottom: '20px'
          }}>
            <div style={{ fontSize: '14px', lineHeight: '1.6', color: '#d46b08' }}>
              <strong>HWP 파일은 자동 분석이 불가능합니다.</strong><br/>
              정확한 평가를 위해 PDF로 변환하거나 캡처하여 업로드하는 것을 권장합니다.<br/>
              <strong style={{ color: '#ff4d4f' }}>※ 수동평가를 요청하시는 경우에만 HWP 파일로 업로드하세요.</strong>
            </div>
          </div>

          {/* 수동평가 안내 */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              fontSize: '16px',
              fontWeight: 'bold',
              color: '#722ed1',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>📋</span>
              <span>수동평가 안내</span>
            </div>
            <div style={{
              padding: '15px',
              backgroundColor: '#f9f0ff',
              borderRadius: '6px',
              border: '1px solid #d3adf7',
              fontSize: '14px',
              lineHeight: '1.8',
              color: '#531dab'
            }}>
              <div style={{ marginBottom: '8px' }}>
                HWP 파일을 업로드하시면 <strong>수동평가 대상</strong>으로 분류됩니다.
              </div>
              <div style={{ marginBottom: '8px' }}>
                • 자동 분석이 불가능하여 <strong>파일명과 파일 크기만 참고</strong>됩니다.
              </div>
              <div>
                • 수동평가를 위해 업로드하시려면 하단의 <strong>"수동평가용으로 업로드"</strong> 버튼을 눌러주세요.
              </div>
            </div>
          </div>

          {/* PDF 변환 방법 */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              fontSize: '16px',
              fontWeight: 'bold',
              color: '#1890ff',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>📄</span>
              <span>PDF 변환 방법 (한글 프로그램)</span>
            </div>
            <div style={{
              padding: '15px',
              backgroundColor: '#f0f5ff',
              borderRadius: '6px',
              border: '1px solid #adc6ff',
              fontSize: '14px',
              lineHeight: '1.8',
              color: '#0050b3'
            }}>
              <div style={{ marginBottom: '8px' }}>
                <strong>1단계:</strong> 한글과컴퓨터 한글 프로그램에서 파일 열기
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>2단계:</strong> 메뉴에서 <strong>"파일"</strong> → <strong>"PDF로 내보내기"</strong> 선택
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>3단계:</strong> 저장 위치 지정 후 저장
              </div>
              <div>
                <strong>4단계:</strong> 변환된 PDF 파일을 다시 업로드
              </div>
            </div>
          </div>

          {/* 캡처 방법 */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              fontSize: '16px',
              fontWeight: 'bold',
              color: '#fa8c16',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>📸</span>
              <span>캡처 방법</span>
            </div>
            <div style={{
              padding: '15px',
              backgroundColor: '#fff7e6',
              borderRadius: '6px',
              border: '1px solid #ffd591',
              fontSize: '14px',
              lineHeight: '1.8',
              color: '#d46b08'
            }}>
              <div style={{ marginBottom: '8px' }}>
                <strong>1단계:</strong> 한글 프로그램에서 필요한 페이지 열기
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>2단계:</strong> 화면 캡처 (Windows: Win+Shift+S, Mac: Cmd+Shift+4)
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>3단계:</strong> PNG 또는 JPG로 저장
              </div>
              <div>
                <strong>4단계:</strong> 이미지 파일을 업로드
              </div>
            </div>
          </div>

          {/* 추가 안내 */}
          <div style={{
            padding: '12px',
            backgroundColor: '#f6ffed',
            borderRadius: '6px',
            border: '1px solid #b7eb8f',
            fontSize: '13px',
            color: '#389e0d',
            textAlign: 'center'
          }}>
            💡 <strong>PDF 변환을 가장 권장합니다.</strong> PDF 파일은 자동 분석이 가능하여 더 정확한 평가가 가능합니다.<br/>
            수동평가가 필요한 경우에만 HWP 파일을 업로드하세요.
          </div>
        </div>

        {/* 버튼 */}
        <div style={{
          padding: '20px',
          borderTop: '1px solid #e9ecef',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '10px',
          backgroundColor: '#fafafa'
        }}>
          <button
            onClick={onCancel}
            style={{
              padding: '10px 20px',
              backgroundColor: '#f5f5f5',
              color: '#666',
              border: '1px solid #d9d9d9',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#e8e8e8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#f5f5f5';
            }}
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '10px 20px',
              backgroundColor: '#722ed1',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#9254de';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#722ed1';
            }}
          >
            수동평가용으로 업로드
          </button>
        </div>
      </div>
    </div>
  );
};

// Q&A 모달 컴포넌트
const QAModal = ({ 
  item, 
  isOpen, 
  onClose 
}: { 
  item: ChecklistItem; 
  isOpen: boolean; 
  onClose: () => void; 
}) => {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>>([]);
  const [error, setError] = useState('');
  const historyContainerRef = useRef<HTMLDivElement>(null);

  // 히스토리 로드
  useEffect(() => {
    if (isOpen && item._id) {
      loadHistory();
    }
  }, [isOpen, item._id]);

  // 답변이 추가되면 자동 스크롤
  useEffect(() => {
    if (history.length > 0 && historyContainerRef.current) {
      const container = historyContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, [history]);

  const loadHistory = async () => {
    try {
      // 개선방안 Q&A인지 확인
      const isEvaluationImprovementQa = item._id === 'evaluation_improvement_qa';
      
      let apiEndpoint;
      
      if (isEvaluationImprovementQa) {
        apiEndpoint = '/api/evaluation-improvement-qa';
      } else {
        apiEndpoint = `/api/qa?itemId=${item._id}`;
      }

      const res = await fetch(apiEndpoint);
      const data = await res.json();
      if (res.ok) {
        setHistory(data.history || []);
      }
    } catch (error) {
      console.error('히스토리 로드 오류:', error);
    }
  };

  // 이상한 문자 및 의미없는 질문 필터링 함수
const isInvalidQuestion = (input: string): boolean => {
  const trimmed = input.trim();
  
  // 1. 빈 문자열 또는 공백만 있는 경우
  if (!trimmed) return true;
  
  // 2. 2글자 이하인 경우
  if (trimmed.length <= 2) return true;
  
  // 3. 숫자만 있는 경우 (1자리 이상)
  if (/^\d+$/.test(trimmed)) return true;
  
  // 4. 특수문자만 있는 경우
  if (/^[^\w가-힣\s]+$/.test(trimmed)) return true;
  
  // 5. 키보드 연타 패턴 (asdf, qwer, zxcv 등)
  const keyboardPatterns = /^(asdf|qwer|zxcv|hjkl|uiop|nm,\.|asd|qwe|zxc|jkl|uio|nm,)$/i;
  if (keyboardPatterns.test(trimmed)) return true;
  
  // 6. 같은 문자 반복 (aaaa, bbbb, 1111 등)
  if (/^(.)\1{2,}$/.test(trimmed)) return true;
  
  // 7. 테스트용 입력
  const testPatterns = /^(test|테스트|test\d+|테스트\d+|testing|테스팅)$/i;
  if (testPatterns.test(trimmed)) return true;
  
  // 8. 의미없는 조합 (abc, def, 123, 456 등)
  if (/^(abc|def|ghi|jkl|mno|pqr|stu|vwx|yz|123|456|789|012|345|678|901)$/i.test(trimmed)) return true;
  
  // 9. 한글 자음/모음만 있는 경우 (ㅇㅇㅇ, ㅏㅏㅏ 등)
  if (/^[ㄱ-ㅎㅏ-ㅣ]{2,}$/.test(trimmed)) return true;
  
  // 10. 이상한 문자 조합 (23ㅓㅗㄷㄴ론 나얼미ㅏㄴ어ㅇㄴ 등)
  if (/[ㄱ-ㅎㅏ-ㅣ]{2,}.*[ㄱ-ㅎㅏ-ㅣ]{2,}/.test(trimmed)) return true;
  
  // 11. 한글과 숫자가 이상하게 섞인 경우 (23ㅓㅗㄷㄴ론 등)
  if (/\d+[ㄱ-ㅎㅏ-ㅣ]+/.test(trimmed)) return true;
  
  // 12. 의미없는 한글 조합 (나얼미ㅏㄴ어ㅇㄴ 등)
  if (/^[가-힣]*[ㄱ-ㅎㅏ-ㅣ]{2,}[가-힣]*$/.test(trimmed)) return true;
  
  // 13. 연속된 자음/모음 (ㅓㅗㄷㄴ, ㅏㄴ어ㅇㄴ 등)
  if (/[ㄱ-ㅎㅏ-ㅣ]{3,}/.test(trimmed)) return true;
  
  return false;
};

  // 의미없는 질문 필터링 함수 (기존 호환성 유지)
  const isMeaninglessQuestion = isInvalidQuestion;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !item._id) return;

    // 의미없는 질문 필터링
    if (isMeaninglessQuestion(question)) {
      alert('올바른 질문을 입력해 주세요.\n\n• 한글, 영문, 숫자가 포함된 의미있는 문장으로 작성해 주세요.\n• "23ㅓㅗㄷㄴ론", "나얼미ㅏㄴ어ㅇㄴ" 같은 이상한 문자는 사용하지 마세요.\n• 최소 3글자 이상의 정상적인 질문을 입력해 주세요.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 개선방안 Q&A인지 확인
      const isEvaluationImprovementQa = item._id === 'evaluation_improvement_qa';
      
      let requestData;
      let apiEndpoint;

      if (isEvaluationImprovementQa) {
        // 개선방안 전용 Q&A
        const evaluationData = JSON.parse(item.requiredEvidence);
        
        requestData = {
          question: question.trim(),
          evaluationData: evaluationData
        };
        
        apiEndpoint = '/api/evaluation-improvement-qa';
      } else {
        // 일반 항목 Q&A
        requestData = {
        itemId: item._id,
        question: question.trim(),
        itemData: {
          item: item.item,
          requiredEvidence: item.requiredEvidence,
          relatedLaw: item.relatedLaw,
          details: item.details,
          evaluationMethod: item.evaluationMethod
        }
      };
        
        apiEndpoint = '/api/qa';
      }

      // 디버깅을 위한 로그 출력
      console.log('=== Q&A 프론트엔드 디버깅 정보 ===');
      console.log('API 엔드포인트:', apiEndpoint);
      console.log('전송할 데이터:', JSON.stringify(requestData, null, 2));
      console.log('================================');

      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });

      const data = await res.json();
      
      if (res.ok) {
        setHistory(data.history || []);
        setQuestion('');
      } else {
        setError(data.error || '답변 생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('Q&A 요청 오류:', error);
      setError('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (!item._id) return;
    
    try {
      // 평가근거 또는 개선방안 Q&A인지 확인
      const isEvaluationBasisQa = item._id === 'evaluation_basis_qa';
      const isEvaluationImprovementQa = item._id === 'evaluation_improvement_qa';
      
      let apiEndpoint;
      
      if (isEvaluationBasisQa) {
        apiEndpoint = '/api/evaluation-basis-qa';
      } else if (isEvaluationImprovementQa) {
        apiEndpoint = '/api/evaluation-improvement-qa';
      } else {
        apiEndpoint = `/api/qa?itemId=${item._id}`;
      }
      
      const res = await fetch(apiEndpoint, {
        method: 'DELETE'
      });
      
      if (res.ok) {
        setHistory([]);
      }
    } catch (error) {
      console.error('히스토리 삭제 오류:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          maxWidth: '90vw',
          maxHeight: '90vh',
          width: '800px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #edebe9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#f8f9fa'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#323130' }}>
              AI Q&A - {item.item}
            </h3>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              항목번호: {item.itemNumber}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleClearHistory}
              style={{
                padding: '6px 12px',
                backgroundColor: '#ff4d4f',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
              title="대화 히스토리 삭제"
            >
              히스토리 삭제
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '20px',
                cursor: 'pointer',
                color: '#666',
                padding: '4px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              ✕
            </button>
          </div>
        </div>

        {/* 컨텍스트 정보 */}
        <div style={{
          padding: '12px 20px',
          backgroundColor: '#f0f8ff',
          borderBottom: '1px solid #91d5ff',
          fontSize: '12px'
        }}>
          <div style={{ fontWeight: '600', marginBottom: '8px', color: '#1890ff' }}>
            📋 참고 정보 (AI Assistant 답변의 근거):
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '6px', fontSize: '11px' }}>
            {item._id === 'evaluation_basis_qa' ? (
              // 평가근거 AI Assistant - 평가근거와 원본 항목 정보 표시
              <>
                <div><strong>평가근거:</strong> {item.evaluationMethod.substring(0, 100)}...</div>
                <div><strong>준수율:</strong> {item.relatedLaw}</div>
                <div><strong>원본 항목:</strong> {JSON.parse(item.requiredEvidence).originalItem.item}</div>
                <div><strong>평가방법:</strong> {JSON.parse(item.requiredEvidence).originalItem.evaluationMethod.substring(0, 80)}...</div>
                <div><strong>필요증빙:</strong> {JSON.parse(item.requiredEvidence).originalItem.requiredEvidence.substring(0, 80)}...</div>
              </>
            ) : item._id === 'evaluation_improvement_qa' ? (
              // 개선방안 AI Assistant - 개선방안과 원본 항목 정보 표시
              <>
                <div><strong>개선방안:</strong> {item.evaluationMethod.substring(0, 100)}...</div>
                <div><strong>준수율:</strong> {item.relatedLaw}</div>
                <div><strong>원본 항목:</strong> {JSON.parse(item.requiredEvidence).originalItem.item}</div>
                <div><strong>평가방법:</strong> {JSON.parse(item.requiredEvidence).originalItem.evaluationMethod.substring(0, 80)}...</div>
                <div><strong>필요증빙:</strong> {JSON.parse(item.requiredEvidence).originalItem.requiredEvidence.substring(0, 80)}...</div>
              </>
            ) : (
              // 일반 항목 AI Assistant
              <>
            <div><strong>평가항목:</strong> {item.item}</div>
            <div><strong>필요증빙:</strong> {item.requiredEvidence}</div>
            <div><strong>관련법령:</strong> {item.relatedLaw}</div>
            <div><strong>세부조항:</strong> {item.details}</div>
            <div><strong>평가방법:</strong> {item.evaluationMethod}</div>
              </>
            )}
          </div>
        </div>

        {/* 대화 히스토리 */}
        <div 
          ref={historyContainerRef}
          style={{ 
            flex: 1, 
            overflow: 'auto', 
            padding: '20px',
            maxHeight: '400px'
          }}
        >
          {history.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              color: '#666', 
              fontStyle: 'italic',
              padding: '40px 20px'
            }}>
              첫 번째 질문을 해보세요!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {history.map((message, index) => (
                <div key={index} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '12px',
                    color: '#666'
                  }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      backgroundColor: message.role === 'user' ? '#1890ff' : '#52c41a',
                      color: 'white'
                    }}>
                      {message.role === 'user' ? '질문' : '답변'}
                    </span>
                    <span>
                      {new Date(message.timestamp).toLocaleString('ko-KR')}
                    </span>
                  </div>
                  <div style={{
                    padding: '12px',
                    backgroundColor: message.role === 'user' ? '#f0f8ff' : '#f6ffed',
                    borderRadius: '8px',
                    border: `1px solid ${message.role === 'user' ? '#91d5ff' : '#b7eb8f'}`,
                    lineHeight: '1.5',
                    fontSize: '14px'
                  }}>
                    {message.role === 'assistant' ? renderTextWithTables(message.content) : message.content}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 질문 입력 */}
        <div style={{
          padding: '20px',
          borderTop: '1px solid #edebe9',
          backgroundColor: '#fafafa'
        }}>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="질문을 입력하세요..."
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
                onFocus={(e) => e.target.style.borderColor = '#1890ff'}
                onBlur={(e) => e.target.style.borderColor = '#d9d9d9'}
              />
              <button
                type="submit"
                disabled={loading || !question.trim()}
                style={{
                  padding: '10px 20px',
                  backgroundColor: loading ? '#ccc' : '#1890ff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                {loading ? '답변 중...' : '질문하기'}
              </button>
            </div>
          </form>
          {error && (
            <div style={{
              marginTop: '8px',
              padding: '8px 12px',
              backgroundColor: '#fff2f0',
              border: '1px solid #ffccc7',
              borderRadius: '4px',
              color: '#ff4d4f',
              fontSize: '12px'
            }}>
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 마크다운 표를 HTML 테이블로 변환하는 함수
const renderMarkdownTable = (text: string): string => {
  const lines = text.split('\n');
  let inTable = false;
  let tableLines: string[] = [];
  let result: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 표 시작 감지 (|로 시작하거나 끝나는 줄)
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      if (!inTable) {
        inTable = true;
        tableLines = [];
      }
      tableLines.push(line);
    } else if (inTable) {
      // 표 끝 - 테이블 렌더링
      if (tableLines.length > 0) {
        result.push(convertTableToHTML(tableLines));
        tableLines = [];
      }
      inTable = false;
      result.push(line);
    } else {
      result.push(line);
    }
  }
  
  // 마지막 표 처리
  if (inTable && tableLines.length > 0) {
    result.push(convertTableToHTML(tableLines));
  }
  
  return result.join('\n');
};

// 마크다운 표를 HTML 테이블로 변환
const convertTableToHTML = (tableLines: string[]): string => {
  if (tableLines.length < 2) return tableLines.join('\n');
  
  let html = '<table style="border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 14px;">';
  
  for (let i = 0; i < tableLines.length; i++) {
    const line = tableLines[i];
    const cells = line.split('|').slice(1, -1); // 첫 번째와 마지막 빈 요소 제거
    
    if (i === 0) {
      // 헤더 행
      html += '<thead><tr>';
      cells.forEach(cell => {
        html += `<th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: #f8f9fa; font-weight: bold;">${cell.trim()}</th>`;
      });
      html += '</tr></thead><tbody>';
    } else if (i === 1 && line.includes('---')) {
      // 구분선 행은 건너뛰기
      continue;
    } else {
      // 데이터 행
      html += '<tr>';
      cells.forEach(cell => {
        html += `<td style="border: 1px solid #ddd; padding: 8px; text-align: left;">${cell.trim()}</td>`;
      });
      html += '</tr>';
    }
  }
  
  html += '</tbody></table>';
  return html;
};

// 텍스트를 HTML로 렌더링하는 함수
const renderTextWithTables = (text: string): JSX.Element => {
  const processedText = renderMarkdownTable(text);
  const parts = processedText.split(/(<table[\s\S]*?<\/table>)/g);
  
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('<table')) {
          return <div key={index} dangerouslySetInnerHTML={{ __html: part }} />;
        } else {
          return <span key={index} style={{ whiteSpace: 'pre-wrap' }}>{part}</span>;
        }
      })}
    </>
  );
};

const ChecklistPage = () => {
  const [data, setData] = useState<ChecklistItem[]>([]);
  const [selected, setSelected] = useState<ChecklistItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalState, setModalState] = useState({
    status: '',
    resultText: '',
    resultFiles: [] as string[],
    progress: 0,
    improvement: '',
  });

  // 이상한 문자 및 의미없는 텍스트 필터링 함수
  const isInvalidText = (input: string): boolean => {
    const trimmed = input.trim();
    
    // 1. 빈 문자열 또는 공백만 있는 경우
    if (!trimmed) return true;
    
    // 2. 10글자 이하인 경우 (이행현황은 좀 더 관대하게)
    if (trimmed.length <= 10) return true;
    
    // 3. 숫자만 있는 경우 (3자리 이상)
    if (/^\d{3,}$/.test(trimmed)) return true;
    
    // 4. 특수문자만 있는 경우
    if (/^[^\w가-힣\s]{3,}$/.test(trimmed)) return true;
    
    // 5. 키보드 연타 패턴 (asdf, qwer, zxcv 등)
    const keyboardPatterns = /^(asdf|qwer|zxcv|hjkl|uiop|nm,\.|asd|qwe|zxc|jkl|uio|nm,)$/i;
    if (keyboardPatterns.test(trimmed)) return true;
    
    // 6. 같은 문자 반복 (aaaa, bbbb, 1111 등)
    if (/^(.)\1{3,}$/.test(trimmed)) return true;
    
    // 7. 테스트용 입력
    const testPatterns = /^(test|테스트|test\d+|테스트\d+|testing|테스팅)$/i;
    if (testPatterns.test(trimmed)) return true;
    
    // 8. 의미없는 조합 (abc, def, 123, 456 등)
    if (/^(abc|def|ghi|jkl|mno|pqr|stu|vwx|yz|123|456|789|012|345|678|901)$/i.test(trimmed)) return true;
    
    // 9. 한글 자음/모음만 있는 경우 (ㅇㅇㅇ, ㅏㅏㅏ 등)
    if (/^[ㄱ-ㅎㅏ-ㅣ]{3,}$/.test(trimmed)) return true;
    
    // 10. 이상한 문자 조합 (23ㅓㅗㄷㄴ론 나얼미ㅏㄴ어ㅇㄴ 등)
    if (/[ㄱ-ㅎㅏ-ㅣ]{2,}.*[ㄱ-ㅎㅏ-ㅣ]{2,}/.test(trimmed)) return true;
    
    // 11. 한글과 숫자가 이상하게 섞인 경우 (23ㅓㅗㄷㄴ론 등)
    if (/\d+[ㄱ-ㅎㅏ-ㅣ]+/.test(trimmed)) return true;
    
    // 12. 의미없는 한글 조합 (나얼미ㅏㄴ어ㅇㄴ 등)
    if (/^[가-힣]*[ㄱ-ㅎㅏ-ㅣ]{2,}[가-힣]*$/.test(trimmed)) return true;
    
    // 13. 연속된 자음/모음 (ㅓㅗㄷㄴ, ㅏㄴ어ㅇㄴ 등)
    if (/[ㄱ-ㅎㅏ-ㅣ]{4,}/.test(trimmed)) return true;
    
    return false;
  };

  // 의미없는 텍스트 필터링 함수 (기존 호환성 유지)
  const isMeaninglessText = isInvalidText;
  const [uploading, setUploading] = useState(false);
  const [deletingFile, setDeletingFile] = useState<number | null>(null);
  const [uploadMessage, setUploadMessage] = useState('');
  const [deleteMessage, setDeleteMessage] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addState, setAddState] = useState({
    category: '',
    subCategory: '',
    item: '',
    itemNumber: '',
    evaluationMethod: '',
    requiredEvidence: '',
    relatedLaw: '',
    details: '',
  });
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editState, setEditState] = useState({
    category: '',
    subCategory: '',
    item: '',
    itemNumber: '',
    evaluationMethod: '',
    requiredEvidence: '',
    relatedLaw: '',
    details: '',
  });
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<{
    progress: number;
    improvement: string;
    basis: string;
    error?: string;
    details?: string;
    evidenceAnalysis?: {
      needsEvidence: boolean;
      evidenceEvaluation: {
        hasEvidence: boolean;
        evidenceQuality: 'high' | 'medium' | 'low' | 'none';
        missingEvidence: string[];
        evidenceTypes: string[];
        complianceScore: number;
      };
      evidenceValidation?: {
        isRelevant: boolean;
        isAppropriate: boolean;
        isComplete: boolean;
        validationScore: number;
        issues: string[];
        recommendations: string[];
      };
      evidenceImpact: string;
      guidance?: string;
    };
  } | null>(null);
  
  // 파일 미리보기 상태
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<string>('');
  
  // Q&A 상태
  const [qaModalOpen, setQaModalOpen] = useState(false);
  const [qaItem, setQaItem] = useState<ChecklistItem | null>(null);
  
  // HWP 파일 안내 모달 상태
  const [hwpWarningModalOpen, setHwpWarningModalOpen] = useState(false);
  const [pendingHwpFile, setPendingHwpFile] = useState<File | null>(null);
  
  // 구버전 파일 안내 모달 상태
  const [oldFileWarningModalOpen, setOldFileWarningModalOpen] = useState(false);
  const [pendingOldFile, setPendingOldFile] = useState<File | null>(null);
  const [oldFileType, setOldFileType] = useState<'doc' | 'ppt'>('doc');
  
  // 컬럼 표시/숨김 상태
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchChecklist().then(setData);
  }, []);

  // 삭제 핸들러
  async function handleDelete(_id: string) {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    const res = await fetch('/api/checklist', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _id }),
    });
    if (res.ok) {
      setData(prev => prev.filter(item => item._id !== _id));
    } else {
      alert('삭제 처리에 실패했습니다.');
    }
  }

  // 수정 모달 열기
  function handleOpenEditModal(item: ChecklistItem) {
    setEditingItem(item);
    setEditState({
      category: item.category || '',
      subCategory: item.subCategory || '',
      item: item.item || '',
      itemNumber: item.itemNumber || '',
      evaluationMethod: item.evaluationMethod || '',
      requiredEvidence: item.requiredEvidence || '',
      relatedLaw: item.relatedLaw || '',
      details: item.details || '',
    });
    setEditModalOpen(true);
  }

  // 수정 모달 닫기
  function handleCloseEditModal() {
    setEditModalOpen(false);
    setEditingItem(null);
  }

  // 수정 저장
  async function handleEditSave() {
    if (!editingItem) return;
    
    const updated = { ...editingItem, ...editState };
    const res = await fetch('/api/checklist', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
    
    if (res.ok) {
      setData(prev => prev.map(item => item._id === updated._id ? updated : item));
      handleCloseEditModal();
    } else {
      alert('수정 처리에 실패했습니다.');
    }
  }

  // 개선방안에 권고만 있는지 확인하는 함수
  const hasOnlyRecommendations = (improvement: string): boolean => {
    if (!improvement) return false;
    const text = improvement.toLowerCase();
    
    // 명시적인 통과 메시지 패턴을 먼저 확인
    const passPatterns = [
      '모든 기준을 충족하여 추가 개선사항 없음',
      '모든 필수 기준을 충족하여 통과',
      '추가 개선사항 없음',
    ];
    
    if (passPatterns.some(pattern => text.includes(pattern.toLowerCase()))) {
      return true;
    }
    
    // "권고"만 있고 "필수"가 없는 경우도 통과로 간주
    if (text.includes('권고') && !text.includes('필수')) {
      return true;
    }

    // 필수, 필요 등 강제성 키워드가 없으면 권고만으로 판단
    const requiredKeywords = ['필수', '필수사항', '반드시', '필요', '요구', '의무', '강제'];
    return !requiredKeywords.some(keyword => text.includes(keyword));
  };

  // 상태와 색상을 결정하는 함수
  const getStatusInfo = (progress: number, improvement: string): {
    status: string;
    color: string;
    backgroundColor: string;
    borderColor: string;
  } => {
    // '개선방안' 내용에 기반해 통과 여부를 명확히 결정
    const onlyRecommendations = hasOnlyRecommendations(improvement);

    // 기준 미충족: progress === 0
    if (progress === 0) {
      return {
        status: '기준 미충족',
        color: '#FF4D4F',
        backgroundColor: '#FFF2F0',
        borderColor: '#FFCCC7'
      };
    }

    // 개선 필요: 0 < progress < 70
    if (progress > 0 && progress < 70) {
      return {
        status: '개선 필요',
        color: '#FAAD14',
        backgroundColor: '#FFF7E6',
        borderColor: '#FFD591'
      };
    }

    // 통과: progress === 100 또는 (progress >= 70 && onlyRecommendations === true)
    if (progress === 100 || (progress >= 70 && onlyRecommendations)) {
      return {
        status: '통과',
        color: '#52C41A',
        backgroundColor: '#F6FFED',
        borderColor: '#B7EB8F'
      };
    }
    
    // 개선 후 재평가: 70 <= progress < 100 && onlyRecommendations === false
    return {
      status: '개선 후 재평가',
      color: '#FAAD14',
      backgroundColor: '#FFF7E6',
      borderColor: '#FFD591'
    };
  };

  function handleOpenModal(item: ChecklistItem) {
    setSelected(item);
    setModalState({
      status: item.status || '',
      resultText: item.resultText || '',
      resultFiles: item.resultFiles || [],
      progress: item.progress || 0,
      improvement: item.improvement || '',
    });

    // 이전 평가 결과 초기화
    setEvaluationResult(null);
    setEvaluating(false);

    setModalOpen(true);
    
    // 파일 목록 초기화
    setUploadMessage('');
    setDeleteMessage('');
    
    // 파일 존재 여부 확인 및 정리
    if (item.resultFiles && item.resultFiles.length > 0) {
      checkAndCleanFiles(item.resultFiles, item._id);
    }
  }

  // 파일 존재 여부 확인 및 정리 함수
  async function checkAndCleanFiles(files: string[], itemId?: string) {
    const validFiles: string[] = [];
    
    for (const filePath of files) {
      try {
        const response = await fetch(`/api/upload?filePath=${encodeURIComponent(filePath)}`);
        const data = await response.json();
        
        if (data.exists) {
          validFiles.push(filePath);
        } else {
          console.log('존재하지 않는 파일 제거:', filePath);
        }
      } catch (error) {
        console.error('파일 확인 오류:', error);
        // 오류 발생 시 파일을 유지 (안전을 위해)
        validFiles.push(filePath);
      }
    }
    
    // 유효한 파일만 남기고 DB 업데이트
    if (validFiles.length !== files.length && itemId && selected) {
      const updated: ChecklistItem = { 
        ...selected, 
        resultFiles: validFiles 
      };
      
      try {
        const updateRes = await fetch('/api/checklist', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated),
        });
        
        if (updateRes.ok) {
          setData(prev => prev.map(item => item._id === itemId ? updated : item));
          setModalState(prev => ({ ...prev, resultFiles: validFiles }));
          console.log('파일 목록 정리 완료:', validFiles);
        }
      } catch (error) {
        console.error('DB 업데이트 오류:', error);
      }
    }
  }

  // 컬럼 토글 함수
  const toggleColumn = useCallback((columnId: string) => {
    setHiddenColumns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(columnId)) {
        newSet.delete(columnId);
      } else {
        newSet.add(columnId);
      }
      return newSet;
    });
  }, []);

  const columns = useMemo<Column<ChecklistItem>[]>(
    () => [
      { 
        Header: '대항목', 
        accessor: 'category', 
        width: 120,
        Cell: ({ value, row }) => (
          <div 
            style={{ 
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '4px',
              transition: 'background-color 0.2s',
              width: '100%'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f2f1'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            onDoubleClick={() => handleOpenEditModal(row.original)}
            title="더블클릭하여 수정"
          >
            <span style={{ fontWeight: '600', color: '#323130' }}>{value}</span>
          </div>
        )
      },
      { 
        Header: '중항목', 
        accessor: 'subCategory', 
        width: 120,
        Cell: ({ value, row }) => (
          <div 
            style={{ 
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '4px',
              transition: 'background-color 0.2s',
              width: '100%'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f2f1'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            onDoubleClick={() => handleOpenEditModal(row.original)}
            title="더블클릭하여 수정"
          >
            <span style={{ color: '#605e5c' }}>{value}</span>
          </div>
        )
      },
      { 
        Header: '점검항목', 
        accessor: 'item', 
        width: 180,
        Cell: ({ value, row }) => (
          <div 
            style={{ 
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '4px',
              transition: 'background-color 0.2s',
              width: '100%'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f2f1'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            onDoubleClick={() => handleOpenEditModal(row.original)}
            title="더블클릭하여 수정"
          >
            <span style={{ fontWeight: '500', color: '#323130', lineHeight: '1.4' }}>{value}</span>
          </div>
        )
      },
      { 
        Header: '항목번호', 
        accessor: 'itemNumber', 
        width: 100,
        Cell: ({ value, row }) => (
          <div 
            style={{ 
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '4px',
              transition: 'background-color 0.2s',
              width: '100%'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f2f1'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            onDoubleClick={() => handleOpenEditModal(row.original)}
            title="더블클릭하여 수정"
          >
            <span style={{ 
              color: '#605e5c', 
              fontSize: '13px',
              fontFamily: 'monospace'
            }}>{value}</span>
          </div>
        )
      },
      { 
        Header: '평가방법', 
        accessor: 'evaluationMethod', 
        width: 200,
        Cell: ({ value, row }) => (
          <div 
            style={{ 
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '4px',
              transition: 'background-color 0.2s',
              width: '100%'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f2f1'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            onDoubleClick={() => handleOpenEditModal(row.original)}
            title="더블클릭하여 수정"
          >
            <div style={{ 
              fontSize: '13px', 
              color: '#605e5c', 
              lineHeight: '1.4',
              wordWrap: 'break-word',
              overflowWrap: 'break-word',
              whiteSpace: 'pre-wrap',
              width: '100%',
              height: 'auto'
            }}>
              {value}
            </div>
          </div>
        )
      },
      { 
        Header: '필요증빙', 
        accessor: 'requiredEvidence', 
        width: 200,
        Cell: ({ value, row }) => (
          <div 
            style={{ 
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '4px',
              transition: 'background-color 0.2s',
              width: '100%'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f2f1'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            onDoubleClick={() => handleOpenEditModal(row.original)}
            title="더블클릭하여 수정"
          >
            <div style={{ 
              fontSize: '13px', 
              color: '#605e5c', 
              lineHeight: '1.4',
              wordWrap: 'break-word',
              overflowWrap: 'break-word',
              whiteSpace: 'pre-wrap',
              width: '100%',
              height: 'auto'
            }}>
              {value}
            </div>
          </div>
        )
      },
      { 
        Header: '관련법령 및 규정', 
        accessor: 'relatedLaw', 
        width: 180,
        Cell: ({ value, row }) => (
          <div 
            style={{ 
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '4px',
              transition: 'background-color 0.2s',
              width: '100%'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f2f1'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            onDoubleClick={() => handleOpenEditModal(row.original)}
            title="더블클릭하여 수정"
          >
            <div style={{ 
              fontSize: '13px', 
              color: '#605e5c', 
              lineHeight: '1.4',
              wordWrap: 'break-word',
              overflowWrap: 'break-word',
              whiteSpace: 'pre-wrap',
              width: '100%',
              height: 'auto'
            }}>
              {value}
            </div>
          </div>
        )
      },
      { 
        Header: '세부조항', 
        accessor: 'details', 
        width: 180,
        Cell: ({ value, row }) => (
          <div 
            style={{ 
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '4px',
              transition: 'background-color 0.2s',
              width: '100%'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f2f1'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            onDoubleClick={() => handleOpenEditModal(row.original)}
            title="더블클릭하여 수정"
          >
            <div style={{ 
              fontSize: '13px', 
              color: '#605e5c', 
              lineHeight: '1.4',
              wordWrap: 'break-word',
              overflowWrap: 'break-word',
              whiteSpace: 'pre-wrap',
              width: '100%',
              height: 'auto'
            }}>
              {value}
            </div>
          </div>
        )
      },
      {
        Header: '이행여부',
        accessor: 'status',
        Cell: ({ row }) => {
          const item = row.original;
          const hasProgress = typeof item.progress === 'number';
          const hasImprovement = item.improvement && item.improvement.trim() !== '';
          
          if (!hasProgress || !hasImprovement) {
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                <button 
                  onClick={() => handleOpenModal(item)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#0078d4',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '500',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#106ebe'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0078d4'}
                >
                  평가
                </button>
                <button 
                  onClick={() => handleOpenQAModal(item)}
                  style={{
                    padding: '4.4px 8.8px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: '500',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#218838'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#28a745'}
                  title="AI Q&A 문의"
                >
                  AI Q&A
                </button>
              </div>
            );
          }
          
          const statusInfo = getStatusInfo(item.progress || 0, item.improvement || '');
          return (
            <div style={{ textAlign: 'center', width: '100%' }}>
              <div style={{
                padding: '4px 8px',
                backgroundColor: statusInfo.backgroundColor,
                color: statusInfo.color,
                border: `1px solid ${statusInfo.borderColor}`,
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '600',
                marginBottom: '4px',
                whiteSpace: 'nowrap'
              }}>
                {statusInfo.status}
              </div>
              <div style={{
                fontSize: '14px',
                fontWeight: '600',
                color: statusInfo.color,
                marginBottom: '4px'
              }}>
                {item.progress}%
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
                <button 
                  onClick={() => handleOpenModal(item)}
                  style={{
                    padding: '3px 8px',
                    backgroundColor: 'transparent',
                    color: statusInfo.color,
                    border: `1px solid ${statusInfo.color}`,
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '10px',
                    fontWeight: '500',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = statusInfo.color;
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = statusInfo.color;
                  }}
                >
                  재평가
                </button>
                <button 
                  onClick={() => handleOpenQAModal(item)}
                  style={{
                    padding: '4.4px 8.8px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: '500',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#218838'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#28a745'}
                  title="AI Q&A 문의"
                >
                  AI Q&A
                </button>
              </div>
            </div>
          );
        },
        width: 120,
      },
      {
        Header: '첨부파일',
        accessor: 'resultFiles',
        Cell: ({ value }) => {
          if (!value || value.length === 0) {
            return (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: '#605e5c',
                fontSize: '12px'
              }}>
                <span style={{ opacity: 0.6 }}>없음</span>
              </div>
            );
          }
          return (
            <div style={{ fontSize: '11px', width: '100%' }}>
              <div style={{ 
                color: '#0078d4', 
                fontWeight: '600',
                marginBottom: '4px',
                textAlign: 'center'
              }}>
                {value.length}개 파일
              </div>
              {value.slice(0, 2).map((file: string, index: number) => (
                <div key={index} style={{ 
                  color: '#605e5c', 
                  marginBottom: '2px',
                  fontSize: '10px',
                  textAlign: 'center',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {file.split('/').pop() || file}
                </div>
              ))}
              {value.length > 2 && (
                <div style={{ 
                  color: '#605e5c', 
                  fontSize: '10px',
                  textAlign: 'center',
                  opacity: 0.7
                }}>
                  +{value.length - 2}개 더...
                </div>
              )}
            </div>
          );
        },
        width: 120,
      },
      {
        Header: '삭제',
        id: 'delete',
        Cell: ({ row }) => (
          <button
            style={{ 
              color: '#d13438', 
              border: 'none', 
              background: 'none', 
              cursor: 'pointer',
              fontSize: '12px',
              padding: '4px 8px',
              borderRadius: '4px',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fed9cc'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            onClick={() => handleDelete(row.original._id!)}
          >
            삭제
          </button>
        ),
        width: 80,
      },
    ],
    []
  );

  // 숨겨진 컬럼을 제외한 컬럼 필터링
  const visibleColumns = useMemo(() => {
    return columns.filter(column => !hiddenColumns.has((column as any).accessor));
  }, [columns, hiddenColumns]);

  const tableInstance = useTable({ columns: visibleColumns, data }, useFlexLayout, useResizeColumns);

  function handleCloseModal() {
    setModalOpen(false);
    setSelected(null);
  }

  // 첨부파일 삭제 핸들러
  async function handleDeleteFile(fileIndex: number) {
    const filePath = modalState.resultFiles[fileIndex];
    if (!filePath) return;

    setDeletingFile(fileIndex);
    setDeleteMessage('');

    try {
      console.log('파일 삭제 요청:', filePath);
      
      // 먼저 파일 존재 여부 확인
      const checkResponse = await fetch(`/api/upload?filePath=${encodeURIComponent(filePath)}`);
      const checkData = await checkResponse.json();
      
      if (checkData.exists) {
        // 파일이 존재하면 실제 삭제 시도
        const response = await fetch('/api/upload', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath })
        });

        console.log('삭제 응답 상태:', response.status);
        const responseData = await response.json();
        console.log('삭제 응답 데이터:', responseData);

        if (!response.ok) {
          throw new Error(responseData.error || '파일 삭제 처리에 실패했습니다.');
        }
      } else {
        console.log('파일이 이미 존재하지 않음, DB에서만 제거:', filePath);
      }

      // UI에서 파일 제거
      const updatedFiles = modalState.resultFiles.filter((_, index) => index !== fileIndex);
      setModalState(prev => ({
        ...prev,
        resultFiles: updatedFiles
      }));

      // DB 업데이트
      if (selected) {
        const updated = { 
          ...selected, 
          resultFiles: updatedFiles 
        };
        
        const updateRes = await fetch('/api/checklist', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated),
        });
        
        if (updateRes.ok) {
          setData(prev => prev.map(item => item._id === selected._id ? updated : item));
        }
      }

      setDeleteMessage('파일이 성공적으로 삭제되었습니다.');
      setTimeout(() => setDeleteMessage(''), 3000);

    } catch (error) {
      console.error('파일 삭제 오류:', error);
      const errorMessage = error instanceof Error ? error.message : '파일 삭제 처리에 실패했습니다.';
      setDeleteMessage(errorMessage);
      setTimeout(() => setDeleteMessage(''), 5000);
    } finally {
      setDeletingFile(null);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    const fileName = file.name.toLowerCase();
    
    // HWP 파일 감지
    if (fileName.endsWith('.hwp')) {
      // HWP 파일 정보 저장
      setPendingHwpFile(file);
      // 팝업 표시
      setHwpWarningModalOpen(true);
      // 파일 input 초기화
      e.target.value = '';
      return;
    }
    
    // 구버전 파일 감지 (.doc, .ppt)
    if (fileName.endsWith('.doc')) {
      setPendingOldFile(file);
      setOldFileType('doc');
      setOldFileWarningModalOpen(true);
      e.target.value = '';
      return;
    }
    
    if (fileName.endsWith('.ppt')) {
      setPendingOldFile(file);
      setOldFileType('ppt');
      setOldFileWarningModalOpen(true);
      e.target.value = '';
      return;
    }
    
    // HWP 및 구버전 파일이 아닌 경우 기존 업로드 로직 실행
    setUploading(true);
    setUploadMessage('');
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!res.ok) {
        throw new Error('파일 업로드 처리에 실패했습니다.');
      }
      
      const data = await res.json();
      
      // UI 업데이트
      setModalState((prev) => ({ ...prev, resultFiles: [...prev.resultFiles, data.filePath] }));
      
      // DB 업데이트
      if (selected) {
        const updatedFiles = [...modalState.resultFiles, data.filePath];
        const updated = { 
          ...selected, 
          resultFiles: updatedFiles 
        };
        
        const updateRes = await fetch('/api/checklist', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated),
        });
        
        if (updateRes.ok) {
          setData(prev => prev.map(item => item._id === selected._id ? updated : item));
        }
      }
      
      setUploadMessage('파일이 성공적으로 업로드되었습니다.');
      setTimeout(() => setUploadMessage(''), 3000);
      
    } catch (error) {
      console.error('파일 업로드 오류:', error);
      setUploadMessage('파일 업로드 처리에 실패했습니다.');
      setTimeout(() => setUploadMessage(''), 3000);
    } finally {
      setUploading(false);
    }
  }

  // HWP 파일 업로드 확인 핸들러
  async function handleHwpConfirm() {
    if (!pendingHwpFile) return;
    
    setHwpWarningModalOpen(false);
    setUploading(true);
    setUploadMessage('');
    
    const formData = new FormData();
    formData.append('file', pendingHwpFile);
    
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!res.ok) {
        throw new Error('파일 업로드 처리에 실패했습니다.');
      }
      
      const data = await res.json();
      
      // UI 업데이트
      setModalState((prev) => ({ ...prev, resultFiles: [...prev.resultFiles, data.filePath] }));
      
      // DB 업데이트
      if (selected) {
        const updatedFiles = [...modalState.resultFiles, data.filePath];
        const updated = { 
          ...selected, 
          resultFiles: updatedFiles 
        };
        
        const updateRes = await fetch('/api/checklist', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated),
        });
        
        if (updateRes.ok) {
          setData(prev => prev.map(item => item._id === selected._id ? updated : item));
        }
      }
      
      setUploadMessage('파일이 성공적으로 업로드되었습니다.');
      setTimeout(() => setUploadMessage(''), 3000);
      
    } catch (error) {
      console.error('파일 업로드 오류:', error);
      setUploadMessage('파일 업로드 처리에 실패했습니다.');
      setTimeout(() => setUploadMessage(''), 3000);
    } finally {
      setUploading(false);
      setPendingHwpFile(null);
    }
  }

  // HWP 파일 업로드 취소 핸들러
  function handleHwpCancel() {
    setHwpWarningModalOpen(false);
    setPendingHwpFile(null);
  }

  // 구버전 파일 업로드 확인 핸들러
  async function handleOldFileConfirm() {
    if (!pendingOldFile) return;
    
    setOldFileWarningModalOpen(false);
    setUploading(true);
    setUploadMessage('');
    
    const formData = new FormData();
    formData.append('file', pendingOldFile);
    
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!res.ok) {
        throw new Error('파일 업로드 처리에 실패했습니다.');
      }
      
      const data = await res.json();
      
      // UI 업데이트
      setModalState((prev) => ({ ...prev, resultFiles: [...prev.resultFiles, data.filePath] }));
      
      // DB 업데이트
      if (selected) {
        const updatedFiles = [...modalState.resultFiles, data.filePath];
        const updated = { 
          ...selected, 
          resultFiles: updatedFiles 
        };
        
        const updateRes = await fetch('/api/checklist', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated),
        });
        
        if (updateRes.ok) {
          setData(prev => prev.map(item => item._id === selected._id ? updated : item));
        }
      }
      
      setUploadMessage('파일이 성공적으로 업로드되었습니다. (구버전 파일은 자동 분석이 불가능합니다.)');
      setTimeout(() => setUploadMessage(''), 3000);
      
    } catch (error) {
      console.error('파일 업로드 오류:', error);
      setUploadMessage('파일 업로드 처리에 실패했습니다.');
      setTimeout(() => setUploadMessage(''), 3000);
    } finally {
      setUploading(false);
      setPendingOldFile(null);
    }
  }

  // 구버전 파일 업로드 취소 핸들러
  function handleOldFileCancel() {
    setOldFileWarningModalOpen(false);
    setPendingOldFile(null);
  }

  async function handleSave() {
    if (!selected) return;
    
    // 평가 결과가 없으면 평가를 먼저 요청
    if (!evaluationResult) {
      await handleEvaluate();
      return;
    }
    
    setEvaluating(true);
    
    try {
      const updated = { 
        ...selected, 
        ...modalState, 
        progress: evaluationResult.progress, 
        improvement: evaluationResult.improvement 
      };
      
      const response = await fetch('/api/checklist', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
      
      if (!response.ok) {
        throw new Error('저장 처리에 실패했습니다.');
      }
      
    setData((prev) => prev.map((item) => (item._id === updated._id ? updated : item)));
      alert('평가 결과가 저장되었습니다.');
    handleCloseModal();
    } catch (error) {
      console.error('저장 오류:', error);
      alert(error instanceof Error ? error.message : '저장 처리 중 문제가 발생했습니다.');
    } finally {
      setEvaluating(false);
    }
  }

  async function handleAdd() {
    await fetch('/api/checklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(addState),
    });
    // 저장 후 전체 리스트 새로고침
    fetchChecklist().then(setData);
    setAddModalOpen(false);
    setAddState({
      category: '',
      subCategory: '',
      item: '',
      itemNumber: '',
      evaluationMethod: '',
      requiredEvidence: '',
      relatedLaw: '',
      details: '',
    });
  }

  // 로깅 헬퍼 함수
  const log = (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
  };

  const handleEvaluate = async () => {
    if (!selected) {
      log('평가 요청 실패: 항목이 선택되지 않음');
      return;
    }

    if (!selected.evaluationMethod || !selected.requiredEvidence || !modalState.resultText) {
      log('평가 요청 실패: 필수 입력값 누락', {
        hasEvaluationMethod: !!selected.evaluationMethod,
        hasRequiredEvidence: !!selected.requiredEvidence,
        hasResultText: !!modalState.resultText
      });
      return;
    }

    // 이행현황 텍스트 필터링
    if (isMeaninglessText(modalState.resultText)) {
      alert('올바른 이행현황을 입력해 주세요.\n\n• 구체적인 이행 내용과 현황을 상세히 작성해 주세요.\n• "23ㅓㅗㄷㄴ론", "나얼미ㅏㄴ어ㅇㄴ" 같은 이상한 문자는 사용하지 마세요.\n• 최소 10글자 이상의 의미있는 내용을 입력해 주세요.\n• 예시: "개인정보보호법에 따라 개인정보처리방침을 수립하고, 개인정보보호책임자를 지정하여 운영하고 있습니다."');
      return;
    }

    // 이행여부 선택 검증
    if (!modalState.status) {
      alert('이행여부를 선택해 주세요.');
      return;
    }

    setEvaluating(true);
    setEvaluationResult(null);

    log('평가 요청 시작', {
      itemId: selected._id,
      evaluationMethod: selected.evaluationMethod.substring(0, 100) + '...',
      requiredEvidence: selected.requiredEvidence.substring(0, 100) + '...',
      resultText: modalState.resultText.substring(0, 100) + '...',
      resultFiles: modalState.resultFiles
    });

    try {
      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          evaluationMethod: selected.evaluationMethod,
          requiredEvidence: selected.requiredEvidence,
          resultText: modalState.resultText,
          resultFiles: modalState.resultFiles,
          implementationStatus: modalState.status
        })
      });

      log('API 응답 수신', { 
        status: response.status,
        statusText: response.statusText
      });

      if (!response.ok) {
        const errorData = await response.json();
        log('API 오류 응답', errorData);
        throw new Error(errorData.error || '평가 요청 실패');
      }

      const data = await response.json();
      log('평가 결과 수신', {
        progress: data.progress,
        improvement: data.improvement?.substring(0, 100) + '...',
        basis: data.basis?.substring(0, 100) + '...'
      });

      setEvaluationResult({
        progress: data.progress,
        improvement: data.improvement,
        basis: data.basis,
        evidenceAnalysis: data.evidenceAnalysis
      });


      setModalState(prev => ({
        ...prev,
        progress: data.progress,
        improvement: data.improvement
      }));

      // 이행여부와 평가 결과 연동 로직
      const isPass = data.progress >= 70;
      const selectedStatus = modalState.status;
      const onlyRecommendations = hasOnlyRecommendations(data.improvement || '');

      if (selectedStatus === '이행' && isPass) {
        // 이행 + 70% 이상: 일치 (정상 통과)
        console.log('이행 선택과 평가 결과가 일치합니다.');
      } else if (selectedStatus === '부분이행' && isPass) {
        // 부분이행 + 70% 이상: 불일치 알림
        if (onlyRecommendations) {
          // 권고만 있으면
          alert('기준을 충족하여 통과로 평가되었으나 부분이행으로 선택되어 있습니다. 이행여부를 재확인해 주세요.');
        } else {
          // 필수 항목이 있으면
          alert('부분이행으로 선택했으나 평가 결과가 기준을 충족합니다. 이행여부를 재확인해 주세요.');
        }
      } else if (selectedStatus === '미이행' && isPass) {
        // 미이행 + 70% 이상: 불일치 확인 요청
        const confirmRecheck = confirm('미이행으로 선택했으나 평가 결과가 기준을 충족합니다. 이행현황과 선택을 재확인하시겠습니까?');
        if (confirmRecheck) {
          // 재평가 로직 (선택사항)
          console.log('재확인 요청됨');
        }
      } else if (selectedStatus === '이행' && !isPass) {
        // 이행 + 70% 미만: 불일치 알림
        alert('이행으로 선택했으나 평가 결과가 기준을 충족하지 못했습니다. 이행현황 내용을 보완해 주세요.');
      } else if (selectedStatus === '부분이행' && !isPass) {
        // 부분이행 + 70% 미만: 일치 (정상 미충족)
        console.log('부분이행 선택과 평가 결과가 일치합니다.');
      } else if (selectedStatus === '미이행' && !isPass) {
        // 미이행 + 70% 미만: 일치 (정상 미충족)
        console.log('미이행 선택과 평가 결과가 일치합니다.');
      }
    } catch (error) {
      log('평가 요청 오류', {
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack
        } : error
      });
      
      setEvaluationResult({
        progress: 0,
        improvement: '',
        basis: '',
        error: error instanceof Error ? error.message : '평가 처리 중 문제가 발생했습니다.',
        details: error instanceof Error ? error.stack : '알 수 없는 오류'
      });
      
      alert(error instanceof Error ? error.message : '평가 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setEvaluating(false);
    }
  };

  const handleEvaluationMethodChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    log('평가방법 변경', { 
      length: value.length,
      preview: value.substring(0, 100) + '...'
    });
    setModalState(s => ({ ...s, evaluationMethod: value }));
  };

  const handleRequiredEvidenceChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    log('필요증빙 변경', { 
      length: value.length,
      preview: value.substring(0, 100) + '...'
    });
    setModalState(s => ({ ...s, requiredEvidence: value }));
  };

  const handleResultTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    log('이행현황 변경', { 
      length: value.length,
      preview: value.substring(0, 100) + '...'
    });
    setModalState(s => ({ ...s, resultText: value }));
  };

  // react-table 구조 분해
  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
  } = tableInstance;

  // 파일 미리보기 핸들러
  const handlePreviewFile = (file: string) => {
    setPreviewFile(file);
    setPreviewModalOpen(true);
  };

  const handleClosePreview = () => {
    setPreviewModalOpen(false);
    setPreviewFile('');
  };

  // Q&A 핸들러
  const handleOpenQAModal = (item: ChecklistItem) => {
    setQaItem(item);
    setQaModalOpen(true);
  };

  const handleCloseQAModal = () => {
    setQaModalOpen(false);
    setQaItem(null);
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#faf9f8',
      fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif'
    }}>
      {/* 헤더 */}
      <div style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #edebe9',
        padding: '16px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h1 style={{
            margin: 0,
            fontSize: '22px',
            fontWeight: '600',
            color: '#323130'
          }}>
            내부 관리계획 체크리스트
          </h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => router.push('/dashboard')}
              style={{
                padding: '8px 16px',
                backgroundColor: '#1890ff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
              }}
            >
              📊 사용량 모니터링
            </button>
            <button
              onClick={() => router.push('/load-test')}
              style={{
                padding: '8px 16px',
                backgroundColor: '#52c41a',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
              }}
            >
              ⚡ 부하 테스트
            </button>
            <button 
              onClick={() => setAddModalOpen(true)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#0078d4',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#106ebe'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0078d4'}
            >
              <span style={{ fontSize: '16px' }}>+</span>
              항목 추가
            </button>
          </div>
      </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '24px'
      }}>
        {/* 컬럼 표시 컨트롤 */}
        {hiddenColumns.size > 0 && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            border: '1px solid #edebe9',
            padding: '16px',
            marginBottom: '16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#323130' }}>
              숨겨진 컬럼 ({hiddenColumns.size}개)
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {Array.from(hiddenColumns).map(columnId => {
                const columnHeader = columns.find(col => (col as any).accessor === columnId)?.Header as string || columnId;
                return (
                  <button
                    key={columnId}
                    onClick={() => toggleColumn(columnId)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#0078d4',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '500',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#106ebe'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0078d4'}
                    title={`${columnHeader} 컬럼 다시 표시`}
                  >
                    {columnHeader} 표시
                  </button>
                );
              })}
              <button
                onClick={() => setHiddenColumns(new Set())}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '500',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#218838'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#28a745'}
                title="모든 컬럼 다시 표시"
              >
                모든 컬럼 표시
              </button>
            </div>
          </div>
        )}

        {/* 테이블 컨테이너 */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          border: '1px solid #edebe9',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          maxHeight: 'calc(100vh - 200px)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ 
            overflowX: 'auto',
            overflowY: 'auto',
            flex: 1,
            maxHeight: 'calc(100vh - 200px)',
            minHeight: '400px'
          }}>
            <div {...getTableProps()} style={{ width: '100%', tableLayout: 'fixed' }}>
              {/* 테이블 헤더 */}
              <div style={{
                backgroundColor: '#f3f2f1',
                borderBottom: '1px solid #edebe9',
                position: 'sticky',
                top: 0,
                zIndex: 10
              }}>
            {headerGroups.map((headerGroup) => {
              const { key: hgKey, ...hgRest } = headerGroup.getHeaderGroupProps();
              return (
                    <div key={hgKey} {...hgRest} style={{ 
                      display: 'flex',
                      borderBottom: '1px solid #edebe9'
                    }}>
                  {headerGroup.headers.map((column) => {
                    const col: any = column;
                    const { key: hKey, ...hRest } = col.getHeaderProps();
                    const columnId = col.id;
                    
                    return (
                          <div key={hKey} {...hRest} style={{ 
                            flex: col.width ? `0 0 ${col.width}px` : 1, 
                            padding: '12px 16px', 
                            fontWeight: '600',
                            fontSize: '14px',
                            color: '#323130',
                            position: 'relative',
                            userSelect: 'none',
                            backgroundColor: '#f3f2f1',
                            borderRight: '1px solid #edebe9',
                            cursor: 'pointer',
                            transition: 'background-color 0.2s'
                          }}
                          onClick={() => toggleColumn(columnId)}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e1dfdd'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f3f2f1'}
                          title={`클릭하여 ${col.render('Header')} 컬럼 숨기기`}
                          >
                        {col.render('Header')}
                        {col.canResize && (
                          <div
                            {...col.getResizerProps()}
                            style={{
                              position: 'absolute',
                              right: 0,
                              top: 0,
                              height: '100%',
                                  width: '4px',
                              cursor: 'col-resize',
                              zIndex: 1,
                                  background: '#0078d4',
                                  opacity: 0,
                                  transition: 'opacity 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.3'}
                                onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}
                            onClick={e => e.stopPropagation()}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
              
              {/* 테이블 바디 */}
              <div {...getTableBodyProps()} style={{ minHeight: '200px' }}>
                {rows.length === 0 ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '200px',
                    color: '#605e5c',
                    fontSize: '14px',
                    fontStyle: 'italic'
                  }}>
                    체크리스트 항목이 없습니다. "항목 추가" 버튼을 클릭하여 항목을 추가해주세요.
                  </div>
                ) : (
                  rows.map((row, index) => {
              prepareRow(row);
              const { key: rKey, ...rRest } = row.getRowProps();
              return (
                      <div key={rKey} {...rRest} style={{ 
                        display: 'flex', 
                        borderBottom: '1px solid #f3f2f1',
                        backgroundColor: index % 2 === 0 ? 'white' : '#faf9f8',
                        transition: 'background-color 0.2s',
                        minHeight: '48px',
                        alignItems: 'stretch',
                        height: 'auto'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f3f2f1';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = index % 2 === 0 ? 'white' : '#faf9f8';
                      }}
                      >
                  {row.cells.map((cell) => {
                    const { key: cKey, ...cRest } = cell.getCellProps();
                    const columnId = (cell.column as any).id;

                    
                    return (
                            <div key={cKey} {...cRest} style={{ 
                              flex: (cell.column as any).width ? `0 0 ${(cell.column as any).width}px` : 1, 
                              padding: '12px 16px',
                              fontSize: '14px',
                              color: '#323130',
                              borderRight: '1px solid #f3f2f1',
                              display: 'flex',
                              alignItems: 'flex-start',
                              wordWrap: 'break-word',
                              overflowWrap: 'break-word',
                              whiteSpace: 'normal',
                              height: 'auto',
                              minHeight: '48px',
                              backgroundColor: 'transparent',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#e1f5fe';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                            >
                        {cell.render('Cell')}
                      </div>
                    );
                  })}
                </div>
              );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* 항목 추가 모달 */}
      {addModalOpen && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          width: '100vw', 
          height: '100vh', 
          background: 'rgba(0,0,0,0.4)', 
          zIndex: 1000, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{ 
            background: '#fff', 
            padding: '32px', 
            borderRadius: '8px', 
            minWidth: '500px', 
            maxWidth: '600px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid #edebe9'
          }}>
            <h2 style={{
              margin: '0 0 24px 0',
              fontSize: '20px',
              fontWeight: '600',
              color: '#323130'
            }}>항목 추가</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#323130'
                }}>대항목</label>
                <input 
                  placeholder="대항목을 입력하세요" 
                  value={addState.category} 
                  onChange={e => setAddState(s => ({ ...s, category: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #edebe9',
                    borderRadius: '4px',
                    fontSize: '14px',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#0078d4'}
                  onBlur={(e) => e.target.style.borderColor = '#edebe9'}
                />
            </div>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#323130'
                }}>중항목</label>
                <input 
                  placeholder="중항목을 입력하세요" 
                  value={addState.subCategory} 
                  onChange={e => setAddState(s => ({ ...s, subCategory: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #edebe9',
                    borderRadius: '4px',
                    fontSize: '14px',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#0078d4'}
                  onBlur={(e) => e.target.style.borderColor = '#edebe9'}
                />
            </div>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#323130'
                }}>점검항목</label>
                <input 
                  placeholder="점검항목을 입력하세요" 
                  value={addState.item} 
                  onChange={e => setAddState(s => ({ ...s, item: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #edebe9',
                    borderRadius: '4px',
                    fontSize: '14px',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#0078d4'}
                  onBlur={(e) => e.target.style.borderColor = '#edebe9'}
                />
              </div>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#323130'
                }}>항목번호</label>
                <input 
                  placeholder="항목번호를 입력하세요" 
                  value={addState.itemNumber} 
                  onChange={e => setAddState(s => ({ ...s, itemNumber: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #edebe9',
                    borderRadius: '4px',
                    fontSize: '14px',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#0078d4'}
                  onBlur={(e) => e.target.style.borderColor = '#edebe9'}
                />
              </div>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#323130'
                }}>평가방법</label>
                <input 
                  placeholder="평가방법을 입력하세요" 
                  value={addState.evaluationMethod} 
                  onChange={e => setAddState(s => ({ ...s, evaluationMethod: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #edebe9',
                    borderRadius: '4px',
                    fontSize: '14px',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#0078d4'}
                  onBlur={(e) => e.target.style.borderColor = '#edebe9'}
                />
              </div>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#323130'
                }}>필요증빙</label>
                <input 
                  placeholder="필요증빙을 입력하세요" 
                  value={addState.requiredEvidence} 
                  onChange={e => setAddState(s => ({ ...s, requiredEvidence: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #edebe9',
                    borderRadius: '4px',
                    fontSize: '14px',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#0078d4'}
                  onBlur={(e) => e.target.style.borderColor = '#edebe9'}
                />
              </div>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#323130'
                }}>관련법령 및 규정</label>
                <input 
                  placeholder="관련법령 및 규정을 입력하세요" 
                  value={addState.relatedLaw} 
                  onChange={e => setAddState(s => ({ ...s, relatedLaw: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #edebe9',
                    borderRadius: '4px',
                    fontSize: '14px',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#0078d4'}
                  onBlur={(e) => e.target.style.borderColor = '#edebe9'}
                />
              </div>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#323130'
                }}>세부조항</label>
                <input 
                  placeholder="세부조항을 입력하세요" 
                  value={addState.details} 
                  onChange={e => setAddState(s => ({ ...s, details: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #edebe9',
                    borderRadius: '4px',
                    fontSize: '14px',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#0078d4'}
                  onBlur={(e) => e.target.style.borderColor = '#edebe9'}
                />
              </div>
            </div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'flex-end', 
              gap: '12px', 
              marginTop: '24px' 
            }}>
              <button 
                onClick={() => setAddModalOpen(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f3f2f1',
                  color: '#323130',
                  border: '1px solid #edebe9',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#edebe9'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f3f2f1'}
              >
                취소
              </button>
              <button 
                onClick={handleAdd}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#0078d4',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#106ebe'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0078d4'}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 평가 모달 */}
      {modalOpen && selected && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '20px',
              borderRadius: '5px',
              width: '80%',
              maxWidth: '800px',
              maxHeight: '80vh',
              overflow: 'auto',
            }}
          >
            <h2>평가</h2>
            <div style={{ marginBottom: '10px' }}>
              <label>이행여부:</label>
              <select
                value={modalState.status}
                onChange={(e) =>
                  setModalState((prev) => ({ ...prev, status: e.target.value }))
                }
              >
                <option value="">선택</option>
                <option value="이행">이행</option>
                <option value="미이행">미이행</option>
                <option value="부분이행">부분이행</option>
              </select>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label>이행현황:</label>
              <textarea
                value={modalState.resultText}
                onChange={handleResultTextChange}
                style={{ width: '100%', height: '100px' }}
              />
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label>첨부파일:</label>
              <input 
                type="file" 
                onChange={handleFileChange} 
                disabled={uploading}
                accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.md,.json,.xml,.html,.css,.js,.ts,.jsx,.tsx,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.hwp,.csv"
              />
              {uploading && <div style={{ color: '#1890ff', fontSize: '12px', marginTop: '4px' }}>업로드 중...</div>}
              {uploadMessage && (
                <div style={{ 
                  color: uploadMessage.includes('실패') ? '#ff4d4f' : '#52c41a', 
                  fontSize: '12px', 
                  marginTop: '4px',
                  padding: '4px 8px',
                  backgroundColor: uploadMessage.includes('실패') ? '#fff2f0' : '#f6ffed',
                  borderRadius: '4px',
                  border: `1px solid ${uploadMessage.includes('실패') ? '#ffccc7' : '#b7eb8f'}`
                }}>
                  {uploadMessage}
                </div>
              )}
              {modalState.resultFiles.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>업로드된 파일:</div>
                  {modalState.resultFiles.map((file, index) => (
                    <div key={index} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      padding: '6px 8px',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '4px',
                      marginBottom: '4px',
                      border: '1px solid #e9ecef'
                    }}>
                      <span style={{ fontSize: '12px', color: '#333' }}>
                        {file.split('/').pop() || file}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          onClick={() => handlePreviewFile(file)}
                          style={{ 
                            color: '#1890ff', 
                            border: 'none', 
                            background: 'none', 
                            cursor: 'pointer',
                            fontSize: '12px',
                            padding: '2px 6px',
                            borderRadius: '3px',
                            marginLeft: '4px'
                          }}
                          title="파일 미리보기"
                        >
                          👁️
                        </button>
                        <button
                          onClick={() => handleDeleteFile(index)}
                          disabled={deletingFile === index}
                          style={{ 
                            color: deletingFile === index ? '#ccc' : '#ff4d4f', 
                            border: 'none', 
                            background: 'none', 
                            cursor: deletingFile === index ? 'not-allowed' : 'pointer',
                            fontSize: '12px',
                            padding: '2px 6px',
                            borderRadius: '3px',
                            marginLeft: '4px'
                          }}
                          title={deletingFile === index ? "삭제 중..." : "파일 삭제"}
                        >
                          {deletingFile === index ? '⋯' : '✕'}
                        </button>
                      </div>
                    </div>
                  ))}
                  {deleteMessage && (
                    <div style={{ 
                      color: deleteMessage.includes('실패') ? '#ff4d4f' : '#52c41a', 
                      fontSize: '12px', 
                      marginTop: '4px',
                      padding: '4px 8px',
                      backgroundColor: deleteMessage.includes('실패') ? '#fff2f0' : '#f6ffed',
                      borderRadius: '4px',
                      border: `1px solid ${deleteMessage.includes('실패') ? '#ffccc7' : '#b7eb8f'}`
                    }}>
                      {deleteMessage}
                    </div>
                  )}
                </div>
              )}
            </div>
            {evaluationResult && (
              <>
                {/* 증빙 부적절 시 안내 메시지 표시 */}
                {evaluationResult.evidenceAnalysis?.guidance ? (
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px', color: '#ff4d4f' }}>
                      ⚠️ 증빙 검증 결과:
                    </label>
                    <div style={{ 
                      padding: '15px', 
                      backgroundColor: '#fff2f0', 
                      borderRadius: '8px',
                      border: '2px solid #ff4d4f',
                      fontSize: '13px',
                      whiteSpace: 'pre-line',
                      lineHeight: '1.6'
                    }}>
                      {evaluationResult.evidenceAnalysis.guidance}
                    </div>
                  </div>
                ) : (
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>준수율:</label>
                    {(() => {
                      const statusInfo = getStatusInfo(evaluationResult.progress, evaluationResult.improvement);
                      return (
                    <div style={{ 
                          fontSize: '24px', 
                          fontWeight: 'bold',
                          color: statusInfo.color,
                          textAlign: 'center',
                      padding: '10px', 
                          backgroundColor: statusInfo.backgroundColor,
                          borderRadius: '8px',
                          border: `2px solid ${statusInfo.borderColor}`,
                          marginBottom: '8px'
                        }}>
                          {evaluationResult.progress}%
                        </div>
                      );
                    })()}
                    {(() => {
                      const statusInfo = getStatusInfo(evaluationResult.progress, evaluationResult.improvement);
                      return (
                        <div style={{ 
                          textAlign: 'center',
                          padding: '8px',
                          backgroundColor: statusInfo.backgroundColor,
                          borderRadius: '6px',
                          border: `1px solid ${statusInfo.borderColor}`,
                          color: statusInfo.color,
                          fontWeight: 'bold',
                          fontSize: '14px'
                        }}>
                          {statusInfo.status}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* 상세 평가 결과 섹션 */}
                {evaluationResult && !evaluationResult.evidenceAnalysis?.guidance && (
                  <div style={{ marginBottom: '20px' }}>
                    {/* 평가 근거 섹션 */}
                    <div style={{ marginBottom: '20px' }}>
                      <div style={{ 
                        fontWeight: 'bold', 
                        fontSize: '14px',
                        marginBottom: '10px', 
                        color: '#1890ff',
                        borderBottom: '2px solid #1890ff',
                        paddingBottom: '5px'
                      }}>
                        📊 평가 근거
                      </div>
                      <div style={{ 
                        padding: '15px',
                        backgroundColor: '#ffffff',
                        borderRadius: '8px',
                        border: '1px solid #d9d9d9',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        whiteSpace: 'pre-line',
                        lineHeight: '1.8',
                        fontSize: '13px'
                      }}>
                        {evaluationResult.basis}
                      </div>
                    </div>

                    {/* 개선 방안 섹션 */}
                    {evaluationResult.improvement && (
                      <div style={{ marginBottom: '20px' }}>
                        <div style={{ 
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '10px'
                        }}>
                          <div style={{ 
                            fontWeight: 'bold', 
                            fontSize: '14px',
                            color: '#fa8c16',
                            borderBottom: '2px solid #fa8c16',
                            paddingBottom: '5px'
                          }}>
                            💡 개선 방안
                          </div>
                          <button
                            onClick={() => {
                              // 개선방안 전용 AI Assistant 모달 열기
                              const evaluationData = {
                                progress: evaluationResult.progress,
                                improvement: evaluationResult.improvement,
                                basis: evaluationResult.basis,
                                // 원본 항목 정보 추가
                                originalItem: {
                                  item: selected.item,
                                  itemNumber: selected.itemNumber,
                                  evaluationMethod: selected.evaluationMethod,
                                  requiredEvidence: selected.requiredEvidence,
                                  relatedLaw: selected.relatedLaw,
                                  details: selected.details
                                }
                              };
                              
                              // 임시 상태로 개선방안 Q&A 모달 데이터 설정
                              setQaItem({
                                _id: 'evaluation_improvement_qa',
                                category: '평가결과',
                                subCategory: '개선방안',
                                item: '개선방안 AI Q&A',
                                itemNumber: 'EVAL-IMPROVEMENT-QA',
                                evaluationMethod: evaluationResult.improvement,
                                requiredEvidence: JSON.stringify(evaluationData),
                                relatedLaw: `준수율: ${evaluationResult.progress}%`,
                                details: '',
                                status: '평가완료',
                              });
                              setQaModalOpen(true);
                            }}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#28a745',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '500',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#218838'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#28a745'}
                            title="개선방안 AI Q&A"
                          >
                            AI Q&A
                          </button>
                        </div>
                        <div style={{ 
                          padding: '15px',
                          backgroundColor: '#fff7e6',
                          borderRadius: '8px',
                          border: '1px solid #ffd591',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                          whiteSpace: 'pre-line',
                          lineHeight: '1.8',
                          fontSize: '13px',
                          color: '#d46b08'
                        }}>
                          {evaluationResult.improvement}
                        </div>
                      </div>
                    )}

                  </div>
                )}
                
                {/* 평가 후 첨부파일 관리 섹션 */}
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px', color: '#1890ff' }}>첨부파일 관리:</label>
                  <div style={{ 
                    fontSize: '12px', 
                    color: '#666', 
                    marginBottom: '8px',
                    fontStyle: 'italic'
                  }}>
                    ※ 평가 후에도 파일을 추가하거나 삭제할 수 있습니다
                  </div>
                  <input 
                    type="file" 
                    onChange={handleFileChange} 
                    disabled={uploading}
                    accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.md,.json,.xml,.html,.css,.js,.ts,.jsx,.tsx,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.hwp,.csv"
                  />
                  {uploading && <div style={{ color: '#1890ff', fontSize: '12px', marginTop: '4px' }}>업로드 중...</div>}
                  {uploadMessage && (
                    <div style={{ 
                      color: uploadMessage.includes('실패') ? '#ff4d4f' : '#52c41a', 
                      fontSize: '12px', 
                      marginTop: '4px',
                      padding: '4px 8px',
                      backgroundColor: uploadMessage.includes('실패') ? '#fff2f0' : '#f6ffed',
                      borderRadius: '4px',
                      border: `1px solid ${uploadMessage.includes('실패') ? '#ffccc7' : '#b7eb8f'}`
                    }}>
                      {uploadMessage}
                    </div>
                  )}
                  {modalState.resultFiles.length > 0 && (
                    <div style={{ marginTop: '8px' }}>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>현재 첨부파일:</div>
                      {modalState.resultFiles.map((file, index) => (
                        <div key={index} style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          padding: '8px 10px',
                          backgroundColor: '#f8f9fa',
                          borderRadius: '6px',
                          marginBottom: '6px',
                          border: '1px solid #e9ecef'
                        }}>
                          <span style={{ fontSize: '13px', color: '#333', flex: 1 }}>
                            {file.split('/').pop() || file}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button
                              onClick={() => handlePreviewFile(file)}
                              style={{ 
                                color: '#1890ff', 
                                border: 'none', 
                                background: 'none', 
                                cursor: 'pointer',
                                fontSize: '14px',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontWeight: 'bold'
                              }}
                              title="파일 미리보기"
                            >
                              👁️
                            </button>
                            <button
                              onClick={() => handleDeleteFile(index)}
                              disabled={deletingFile === index}
                              style={{ 
                                color: deletingFile === index ? '#ccc' : '#ff4d4f', 
                                border: 'none', 
                                background: 'none', 
                                cursor: deletingFile === index ? 'not-allowed' : 'pointer',
                                fontSize: '14px',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontWeight: 'bold'
                              }}
                              title={deletingFile === index ? "삭제 중..." : "파일 삭제"}
                            >
                              {deletingFile === index ? '⋯' : '✕'}
                            </button>
                          </div>
                        </div>
                      ))}
                      {deleteMessage && (
                        <div style={{ 
                          color: deleteMessage.includes('실패') ? '#ff4d4f' : '#52c41a', 
                          fontSize: '12px', 
                          marginTop: '4px',
                          padding: '4px 8px',
                          backgroundColor: deleteMessage.includes('실패') ? '#fff2f0' : '#f6ffed',
                          borderRadius: '4px',
                          border: `1px solid ${deleteMessage.includes('실패') ? '#ffccc7' : '#b7eb8f'}`
                        }}>
                          {deleteMessage}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
              </>
            )}
            <div style={{ marginTop: '20px' }}>
              <button 
                onClick={handleEvaluate} 
                disabled={evaluating}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#1890ff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  marginRight: '10px',
                  opacity: evaluating ? 0.5 : 1
                }}
              >
                {evaluating ? '평가중...' : '평가요청'}
              </button>
              <button 
                onClick={handleSave} 
                disabled={evaluating}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#1890ff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  opacity: evaluating ? 0.5 : 1
                }}
              >
                {evaluationResult ? '저장' : '평가 및 저장'}
              </button>
              <button 
                onClick={handleCloseModal}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f5f5f5',
                  color: '#666',
                  border: '1px solid #d9d9d9',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  marginLeft: '10px'
                }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 수정 모달 */}
      {editModalOpen && editingItem && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '20px',
              borderRadius: '5px',
              width: '80%',
              maxWidth: '800px',
              maxHeight: '80vh',
              overflow: 'auto',
            }}
          >
            <h2>항목 수정</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label>대항목:</label>
                <input
                  type="text"
                  value={editState.category}
                  onChange={(e) => setEditState(prev => ({ ...prev, category: e.target.value }))}
                  style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                />
              </div>
              <div>
                <label>중항목:</label>
                <input
                  type="text"
                  value={editState.subCategory}
                  onChange={(e) => setEditState(prev => ({ ...prev, subCategory: e.target.value }))}
                  style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                />
              </div>
              <div>
                <label>점검항목:</label>
                <input
                  type="text"
                  value={editState.item}
                  onChange={(e) => setEditState(prev => ({ ...prev, item: e.target.value }))}
                  style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                />
              </div>
              <div>
                <label>항목번호:</label>
                <input
                  type="text"
                  value={editState.itemNumber}
                  onChange={(e) => setEditState(prev => ({ ...prev, itemNumber: e.target.value }))}
                  style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                />
              </div>
              <div>
                <label>평가방법:</label>
                <textarea
                  value={editState.evaluationMethod}
                  onChange={(e) => setEditState(prev => ({ ...prev, evaluationMethod: e.target.value }))}
                  style={{ width: '100%', padding: '8px', marginTop: '4px', minHeight: '80px', resize: 'vertical' }}
                  placeholder="줄바꿈을 포함하여 입력하세요"
                />
              </div>
              <div>
                <label>필요증빙:</label>
                <textarea
                  value={editState.requiredEvidence}
                  onChange={(e) => setEditState(prev => ({ ...prev, requiredEvidence: e.target.value }))}
                  style={{ width: '100%', padding: '8px', marginTop: '4px', minHeight: '80px', resize: 'vertical' }}
                  placeholder="줄바꿈을 포함하여 입력하세요"
                />
              </div>
              <div>
                <label>관련법령 및 규정:</label>
                <textarea
                  value={editState.relatedLaw}
                  onChange={(e) => setEditState(prev => ({ ...prev, relatedLaw: e.target.value }))}
                  style={{ width: '100%', padding: '8px', marginTop: '4px', minHeight: '80px', resize: 'vertical' }}
                  placeholder="줄바꿈을 포함하여 입력하세요"
                />
              </div>
              <div>
                <label>세부조항:</label>
                <textarea
                  value={editState.details}
                  onChange={(e) => setEditState(prev => ({ ...prev, details: e.target.value }))}
                  style={{ width: '100%', padding: '8px', marginTop: '4px', minHeight: '80px', resize: 'vertical' }}
                  placeholder="줄바꿈을 포함하여 입력하세요"
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button 
                onClick={handleCloseEditModal}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f5f5f5',
                  color: '#666',
                  border: '1px solid #d9d9d9',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                취소
              </button>
              <button 
                onClick={handleEditSave}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#1890ff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 파일 미리보기 모달 */}
      <FilePreviewModal
        file={previewFile}
        isOpen={previewModalOpen}
        onClose={handleClosePreview}
      />
      {/* Q&A 모달 */}
      {qaItem && (
        <QAModal
          item={qaItem}
          isOpen={qaModalOpen}
          onClose={handleCloseQAModal}
        />
      )}
      {/* HWP 파일 안내 모달 */}
      <HwpWarningModal
        isOpen={hwpWarningModalOpen}
        fileName={pendingHwpFile?.name || ''}
        onConfirm={handleHwpConfirm}
        onCancel={handleHwpCancel}
      />
      {/* 구버전 파일 안내 모달 */}
      <OldFileWarningModal
        isOpen={oldFileWarningModalOpen}
        fileName={pendingOldFile?.name || ''}
        fileType={oldFileType}
        onConfirm={handleOldFileConfirm}
        onCancel={handleOldFileCancel}
      />
      {/* AI Assistant 모달 */}
    </div>
  );
};

export default ChecklistPage; 