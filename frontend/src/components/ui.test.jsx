import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card, Kpi, Badge, Status } from './ui';
import { Zap } from 'lucide-react';

describe('UI Components', () => {
  describe('Card', () => {
    it('renders with title', () => {
      render(<Card title="Test Card">Content</Card>);
      expect(screen.getByText('Test Card')).toBeInTheDocument();
    });
  });

  describe('Kpi', () => {
    it('renders with value and label', () => {
      render(<Kpi icon={Zap} label="Test Label" value="100" />);
      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('Test Label')).toBeInTheDocument();
    });
  });

  describe('Badge', () => {
    it('renders with text', () => {
      render(<Badge tone="green">Test Badge</Badge>);
      expect(screen.getByText('Test Badge')).toBeInTheDocument();
    });
  });

  describe('Status', () => {
    it('renders ok status', () => {
      render(<Status ok />);
      expect(screen.getByText('En ligne')).toBeInTheDocument();
    });

    it('renders ko status', () => {
      render(<Status ok={false} />);
      expect(screen.getByText('Hors ligne')).toBeInTheDocument();
    });
  });
});
