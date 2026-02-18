interface PropertyDescriptionProps {
  description?: string | null;
  className?: string;
}

export function PropertyDescription({ description, className = '' }: PropertyDescriptionProps) {
  if (!description || description.trim() === '') {
    return null;
  }

  const text = description.trim();

  const byNewlines = text.split(/\n\n+|\r\n\r\n+/).filter(p => p.trim());

  let paragraphs: string[];

  if (byNewlines.length > 1) {
    paragraphs = byNewlines.map(p => p.trim());
  } else {
    const matched = text.match(/[^.!?]+[.!?]+/g);
    if (!matched) {
      paragraphs = [text];
    } else {
      const matchedText = matched.join('');
      const remainder = text.slice(matchedText.length).trim();
      const sentences = remainder ? [...matched, remainder] : matched;
      paragraphs = [];
      for (let i = 0; i < sentences.length; i += 4) {
        paragraphs.push(sentences.slice(i, i + 4).join(' ').trim());
      }
    }
  }

  return (
    <div className={`pt-3 border-t ${className}`} data-testid="section-about-this-home">
      <h3 className="text-sm font-semibold mb-2 text-foreground" data-testid="heading-about-this-home">
        About This Home
      </h3>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-3" data-testid="text-about-this-home">
        {paragraphs.map((paragraph, i) => (
          <p key={i} data-testid={`text-about-home-${i}`}>{paragraph}</p>
        ))}
      </div>
    </div>
  );
}
