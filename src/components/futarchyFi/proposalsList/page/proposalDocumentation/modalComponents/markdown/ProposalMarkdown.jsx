import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import 'react-quill/dist/quill.snow.css';

const ReactQuill = dynamic(() => import('react-quill'), { ssr: false });

const defaultEmptyData = { markdownContent: '' };

const ProposalMarkdown = ({ initialData, onCompletionChange, stepId }) => {
  const [markdownContent, setMarkdownContent] = useState('');

  useEffect(() => {
    const dataToUse = initialData || defaultEmptyData;
    const currentContent = dataToUse.markdownContent || '';
    if (markdownContent !== currentContent) {
      setMarkdownContent(currentContent);
    }

    const hasActualContent = (currentContent.replace(/<(.|\n)*?>/g, '').trim() !== '');
    if (onCompletionChange) {
      onCompletionChange(hasActualContent, { markdownContent: currentContent });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData]);

  const handleInputChange = (value) => {
    const newContent = value || '';
    setMarkdownContent(newContent);

    if (onCompletionChange) {
      const hasActualContent = (newContent.replace(/<(.|\n)*?>/g, '').trim() !== '');
      onCompletionChange(hasActualContent, { markdownContent: newContent });
    }
  };

  return (
    <div className="space-y-4 mr-2">
      <div className="flex flex-col space-y-2">
        <label
          htmlFor={`${stepId}-markdownEditor`}
          className="block text-sm font-medium text-futarchyGray11 dark:text-futarchyGray112 mb-1"
        >
          Documentation Content
        </label>
        <div className="custom-quill rounded-md border border-futarchyGray62 dark:border-futarchyDarkGray42 bg-white dark:bg-futarchyDarkGray4">
          <ReactQuill
            value={markdownContent}
            onChange={handleInputChange}
            theme="snow"
            placeholder="Write your documentation using the toolbar or rich text..."
            id={`${stepId}-markdownEditor`}
            className="rounded-md quill-editor-dark"
            modules={{
              toolbar: [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                [{ 'align': [] }],
                ['blockquote', 'code-block'],
                ['link', 'image'],
                ['clean']
              ]
            }}
          />
        </div>
        <p className="text-xs text-futarchyGray9 dark:text-futarchyGray8 mt-1">
          Use the toolbar to format your text (headings, bold, italic, lists, links, code, etc.).
        </p>
      </div>
    </div>
  );
};

export default ProposalMarkdown;
