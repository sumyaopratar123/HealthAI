
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  MdHealthAndSafety,
  MdOutlineFileUpload,
  MdDescription,
  MdPictureAsPdf,
  MdTextSnippet,
  MdDownload,
  MdErrorOutline,
  MdCheckCircle,
  MdClose
} from 'react-icons/md';
import './index.css';

const ReportExplanation = () => {
  const [summary, setSummary] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0];

    setError('');
    setSuccess(false);
    setSummary('');

    if (!selectedFile) return;

    const extension = selectedFile.name
      .split('.')
      .pop()
      .toLowerCase();

    if (!['pdf', 'txt'].includes(extension)) {
      setFile(null);
      setError('Please select a PDF or TXT file.');
      event.target.value = '';
      return;
    }

    setFile(selectedFile);
  };

  const handleFileUpload = async (event) => {
    event.preventDefault();

    if (!file) {
      setError('Please select a report before generating the summary.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(
        'http://127.0.0.1:5000/report-summary',
        {
          method: 'POST',
          body: formData
        }
      );

      const data = await response.json();

      if (!response.ok || data.status === 'error') {
        throw new Error(
          data.message || data.error || 'Unable to summarize the report.'
        );
      }

      const result = data.summary;

      if (!result) {
        throw new Error('The server returned an empty summary.');
      }

      setSummary(
        typeof result === 'string'
          ? result
          : JSON.stringify(result, null, 2)
      );
      setSuccess(true);
    } catch (err) {
      console.error('Report summary error:', err);
      setError(
        err.message ||
        'Unable to connect to the backend. Check that Flask is running.'
      );
    } finally {
      setLoading(false);
    }
  };

  const downloadSummary = () => {
    if (!summary) return;

    const blob = new Blob([summary], {
      type: 'text/plain;charset=utf-8'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'HealthAI-Report-Summary.txt';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const resetReport = () => {
    setFile(null);
    setSummary('');
    setError('');
    setSuccess(false);

    const input = document.getElementById('health-report-file');
    if (input) input.value = '';
  };

  return (
    <main className="report-page">
      <section className="report-hero">
        <div className="report-badge">
          <MdHealthAndSafety size={19} />
          HEALTHAI REPORT CENTER
        </div>

        <h1>
          Understand your <span>health report.</span>
        </h1>

        <p>
          Upload your medical report and get an easy-to-understand
          summary to help you understand its contents.
        </p>
      </section>

      <form className="report-upload-card" onSubmit={handleFileUpload}>
        <div className="report-upload-heading">
          <div className="report-icon-box">
            <MdOutlineFileUpload size={29} />
          </div>

          <div>
            <h2>Upload your medical report</h2>
            <p>Choose a PDF or TXT file from your device.</p>
          </div>
        </div>

        <label className="report-dropzone" htmlFor="health-report-file">
          <div className="report-upload-circle">
            {file?.name.toLowerCase().endsWith('.pdf') ? (
              <MdPictureAsPdf size={34} />
            ) : (
              <MdDescription size={34} />
            )}
          </div>

          <strong>
            {file ? file.name : 'Choose a report to upload'}
          </strong>

          <span>
            {file
              ? `${(file.size / 1024).toFixed(1)} KB`
              : 'PDF or TXT format supported'}
          </span>

          <span className="report-browse-button">
            <MdOutlineFileUpload size={19} />
            Browse files
          </span>

          <input
            id="health-report-file"
            type="file"
            accept=".pdf,.txt,application/pdf,text/plain"
            onChange={handleFileChange}
            disabled={loading}
          />
        </label>

        {error && (
          <div className="report-alert report-alert-error" role="alert">
            <MdErrorOutline size={22} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="report-alert report-alert-success">
            <MdCheckCircle size={22} />
            <span>Report summary generated successfully.</span>
          </div>
        )}

        <div className="report-actions">
          <button
            type="button"
            className="report-reset-button"
            onClick={resetReport}
            disabled={loading || (!file && !summary && !error)}
          >
            <MdClose size={19} />
            Clear
          </button>

          <button
            type="submit"
            className="report-submit-button"
            disabled={loading || !file}
          >
            {loading ? (
              <>
                <span className="report-spinner" />
                Generating summary...
              </>
            ) : (
              <>
                <MdHealthAndSafety size={20} />
                Generate Summary
              </>
            )}
          </button>
        </div>
      </form>

      {summary && (
        <section className="report-summary-card">
          <div className="report-summary-header">
            <div className="report-summary-title">
              <div className="report-icon-box">
                <MdTextSnippet size={27} />
              </div>
              <div>
                <h2>Report Summary</h2>
                <p>Generated from your uploaded document</p>
              </div>
            </div>

            <button
              type="button"
              className="report-download-button"
              onClick={downloadSummary}
            >
              <MdDownload size={20} />
              Download
            </button>
          </div>

          <div className="report-summary-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {summary}
            </ReactMarkdown>
          </div>

          <div className="report-medical-note">
            <MdHealthAndSafety size={22} />
            <p>
              This summary is for informational purposes only.
              It is not a diagnosis. Consult a qualified healthcare
              professional for interpretation and treatment decisions.
            </p>
          </div>
        </section>
      )}

      <footer className="report-footer">
        <MdHealthAndSafety size={19} />
        Your health information deserves careful and responsible handling.
      </footer>
    </main>
  );
};

export default ReportExplanation;
